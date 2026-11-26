import crypto from 'node:crypto'
import { Router } from 'express'
import { isValidObjectId } from 'mongoose'
import authenticate, { optionalAuthenticate } from '../../middleware/authenticate.js'
import authorize from '../../middleware/authorize.js'
import { listingPhotosUpload } from '../../middleware/upload.js'
import { uploadLimiter, writeLimiter } from '../../middleware/rateLimiter.js'
import redis from '../../config/redis.js'
import { findCategory, getCategoryTree, photosRequired } from '../categories/category.tree.js'
import { getSettings } from '../settings/settings.service.js'
import asyncHandler from '../../utils/asyncHandler.js'
import ApiResponse from '../../utils/ApiResponse.js'
import ApiError from '../../utils/ApiError.js'
import { escapeRegex, getPagination, paginated, toText } from '../../utils/pagination.js'
import { publicUrl, saveImage, removeFile } from '../../services/storage.service.js'
import Listing, { LOCKED_STATUSES, PUBLIC_FILTER } from './listing.model.js'
import DailyStat from './dailyStat.model.js'
import { toListingView, toListingViews } from './listing.view.js'
import { validateListing } from './listing.validation.js'
import { canRenew, expiryDate } from './listing.expiry.js'
import User from '../users/user.model.js'

const VIEW_DEDUPE_SECONDS = 30 * 60
// Featured ads come first in the default order; ads that are not featured have featuredUntil = null, which sorts last
// "latest" ignores promotions (home page "Recently added")
const SORTS = { newest: { featuredUntil: -1, publishedAt: -1 }, latest: { publishedAt: -1 }, price_asc: { price: 1 }, price_desc: { price: -1 } }

export const searchRouter = Router()
const router = Router()

/* ---------- Public search ---------- */
searchRouter.get('/listings', asyncHandler(async (req, res) => {
  const filter = { ...PUBLIC_FILTER }
  const q = toText(req.query.q).slice(0, 100)
  const tree = await getCategoryTree()
  const category = await findCategory(toText(req.query.category))
  const minPrice = Number(req.query.minPrice)
  const maxPrice = Number(req.query.maxPrice)

  if (q) filter.$or = [{ title: new RegExp(escapeRegex(q), 'i') }, { description: new RegExp(escapeRegex(q), 'i') }]
  // categoryPath holds every level, so a parent category matches all ads in its branch
  const hiddenBranches = tree.ordered.filter((n) => !n.ownActive).map((n) => n.id)
  if (category) filter.categoryPath = hiddenBranches.length ? { $eq: category.id, $nin: hiddenBranches } : category.id
  else if (hiddenBranches.length) filter.categoryPath = { $nin: hiddenBranches }
  if (category) Object.assign(filter, attributeFilters(category, req.query))
  if (req.query.featured === 'true') filter.featuredUntil = { $gt: new Date() }
  if (req.query.city) filter.city = toText(req.query.city)
  if (isValidObjectId(req.query.seller)) filter.seller = req.query.seller
  if (minPrice > 0 || maxPrice > 0) filter.price = { ...(minPrice > 0 && { $gte: minPrice }), ...(maxPrice > 0 && { $lte: maxPrice }) }

  const pagination = getPagination(req.query)
  const [docs, total] = await Promise.all([
    Listing.find(filter).sort(SORTS[req.query.sort] ?? SORTS.newest).skip(pagination.skip).limit(pagination.pageSize),
    Listing.countDocuments(filter),
  ])
  res.json(new ApiResponse(200, paginated(await toListingViews(docs), total, pagination)))
}))

/**
 * Filters on the category's own details, sent as f_<key> for lists and f_<key>_min / f_<key>_max for numbers.
 * Only fields marked filterable are accepted, so the query cannot reach any other attribute.
 */
const attributeFilters = (category, query) => {
  const filter = {}
  for (const field of category.fields.filter((f) => f.filterable)) {
    const path = `attributes.${field.fieldKey}`
    if (field.inputType === 'select') {
      const value = toText(query[`f_${field.fieldKey}`])
      if (field.options.includes(value)) filter[path] = value
    } else if (field.inputType === 'number') {
      const min = Number(query[`f_${field.fieldKey}_min`])
      const max = Number(query[`f_${field.fieldKey}_max`])
      const range = { ...(query[`f_${field.fieldKey}_min`] && Number.isFinite(min) && { $gte: min }), ...(query[`f_${field.fieldKey}_max`] && Number.isFinite(max) && { $lte: max }) }
      if (Object.keys(range).length) filter[path] = range
    }
  }
  return filter
}

/* ---------- Public seller profile ---------- */
export const sellerRouter = Router()

// Only what a buyer needs to trust a seller: never email, phone or account status
sellerRouter.get('/:id', asyncHandler(async (req, res) => {
  const seller = isValidObjectId(req.params.id)
    ? await User.findOne({ _id: req.params.id, role: 'user', accountType: 'seller', status: 'active' }).select('name city phone avatarKey createdAt')
    : null
  if (!seller) throw ApiError.notFound('This seller could not be found')

  const activeListings = await Listing.countDocuments({ ...PUBLIC_FILTER, seller: seller._id })
  res.json(new ApiResponse(200, {
    id: seller.id,
    name: seller.name,
    city: seller.city ?? null,
    avatarUrl: publicUrl(seller.avatarKey),
    memberSince: seller.createdAt,
    phoneVerified: Boolean(seller.phone),
    activeListings,
  }))
}))

/* ---------- Seller's own ads ---------- */
const findOwned = async (req) => {
  const listing = await Listing.findOne({ _id: req.params.id, seller: req.user.id })
  if (!listing) throw ApiError.notFound('This ad could not be found')
  return listing
}

const assertEditable = (listing) => {
  if (LOCKED_STATUSES.includes(listing.status)) throw new ApiError(409, 'Withdrawn, hidden or rejected ads cannot be changed')
}

// Any change to a live ad has to be checked again before buyers see it
const sendBackForReview = (listing) => {
  if (listing.status === 'published') listing.status = 'pending_review'
}

const respond = async (res, listing, message, status = 200) => {
  res.status(status).json(new ApiResponse(status, await toListingView(listing), message))
}

router.get('/mine', authenticate, authorize('user'), asyncHandler(async (req, res) => {
  const filter = { seller: req.user.id }
  if (req.query.status && req.query.status !== 'all') filter.status = toText(req.query.status)
  const pagination = getPagination(req.query, 20)
  const [docs, total] = await Promise.all([
    Listing.find(filter).sort({ updatedAt: -1 }).skip(pagination.skip).limit(pagination.pageSize),
    Listing.countDocuments(filter),
  ])
  res.json(new ApiResponse(200, paginated(await toListingViews(docs), total, pagination)))
}))

router.get('/:id', optionalAuthenticate, asyncHandler(async (req, res) => {
  const listing = await Listing.findById(req.params.id)
  const canSeePrivate = req.user && (req.user.role === 'admin' || listing?.seller.toString() === req.user.id)
  // Only approved ads are public; drafts and ads in review stay visible to the owner and admins
  if (!listing || (listing.status !== 'published' && !canSeePrivate)) throw ApiError.notFound('This ad could not be found')

  if (!canSeePrivate) {
    const viewer = req.user?.id ?? crypto.createHash('sha256').update(`${req.ip}|${req.get('user-agent')}`).digest('hex')
    const firstView = await redis.set(`view:${listing.id}:${viewer}`, '1', 'EX', VIEW_DEDUPE_SECONDS, 'NX')
    if (firstView) {
      listing.views += 1
      await Promise.all([
        Listing.updateOne({ _id: listing._id }, { $inc: { views: 1 } }),
        DailyStat.updateOne({ seller: listing.seller, date: new Date().toISOString().slice(0, 10) }, { $inc: { views: 1 } }, { upsert: true }),
      ])
    }
  }
  await respond(res, listing)
}))

// Up to 4 live ads from the same final category, falling back to its parent; same city first
const SIMILAR_LIMIT = 4
router.get('/:id/similar', asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) throw ApiError.notFound('This ad could not be found')
  const listing = await Listing.findOne({ _id: req.params.id, ...PUBLIC_FILTER }).select('categoryPath city').lean()
  if (!listing) return res.json(new ApiResponse(200, []))

  const levels = [...listing.categoryPath].reverse().slice(0, 2)
  const found = []
  for (const categoryId of levels) {
    if (found.length >= SIMILAR_LIMIT) break
    const docs = await Listing.find({ ...PUBLIC_FILTER, categoryPath: categoryId, _id: { $nin: [listing._id, ...found.map((d) => d._id)] } })
      .sort({ publishedAt: -1 }).limit(SIMILAR_LIMIT * 3)
    found.push(...docs.sort((a, b) => Number(b.city === listing.city) - Number(a.city === listing.city)).slice(0, SIMILAR_LIMIT - found.length))
  }
  res.set('Cache-Control', 'public, max-age=300')
  res.json(new ApiResponse(200, await toListingViews(found)))
}))

router.post('/', authenticate, authorize('user'), writeLimiter, asyncHandler(async (req, res) => {
  if (req.user.accountType !== 'seller') throw new ApiError(403, 'Only seller accounts can post ads')
  const listing = await Listing.create({ ...(await validateListing(req.body)), seller: req.user.id })
  await respond(res, listing, 'Draft saved', 201)
}))

router.patch('/:id', authenticate, authorize('user'), writeLimiter, asyncHandler(async (req, res) => {
  const listing = await findOwned(req)
  assertEditable(listing)
  const current = listing.toObject()
  listing.set(await validateListing({ ...current, ...req.body, attributes: req.body.attributes ?? current.attributes }, { currentCategoryId: current.categoryId }))
  sendBackForReview(listing)
  await listing.save()
  await respond(res, listing, 'Ad updated')
}))

/* ---------- Photos ---------- */
router.post('/:id/photos', authenticate, authorize('user'), uploadLimiter, listingPhotosUpload, asyncHandler(async (req, res) => {
  const listing = await findOwned(req)
  assertEditable(listing)
  const files = req.files ?? []
  if (!files.length) throw ApiError.validation({ photos: 'Add at least one photo' })
  const { maxPhotos } = (await getSettings()).listings
  if (listing.photos.length + files.length > maxPhotos) throw ApiError.validation({ photos: `An ad can have up to ${maxPhotos} photos` })

  const saved = []
  try {
    for (const file of files) saved.push(await saveImage(file.buffer, 'public/listings', 'listing'))
  } catch (error) {
    await Promise.all(saved.map((s) => removeFile(s.key)))
    throw error
  }
  listing.photos.push(...saved.map(({ key, width, height }) => ({ key, width, height })))
  sendBackForReview(listing)
  await listing.save()
  await respond(res, listing, 'Photos added', 201)
}))

router.patch('/:id/photos/order', authenticate, authorize('user'), writeLimiter, asyncHandler(async (req, res) => {
  const listing = await findOwned(req)
  assertEditable(listing)
  const ids = Array.isArray(req.body.photoIds) ? req.body.photoIds.map(String) : []
  const current = listing.photos.map((p) => p._id.toString())
  if (ids.length !== current.length || !current.every((id) => ids.includes(id))) {
    throw ApiError.validation({ photos: 'Send every photo of the ad exactly once' })
  }
  listing.photos = ids.map((id) => listing.photos.id(id))
  await listing.save()
  await respond(res, listing, 'Photo order saved')
}))

router.delete('/:id/photos/:photoId', authenticate, authorize('user'), writeLimiter, asyncHandler(async (req, res) => {
  const listing = await findOwned(req)
  assertEditable(listing)
  const photo = listing.photos.id(req.params.photoId)
  if (!photo) throw ApiError.notFound('Photo not found')
  const category = await findCategory(listing.categoryId)
  if (listing.status !== 'draft' && listing.photos.length === 1 && (!category || photosRequired(category))) {
    throw new ApiError(409, 'An ad needs at least one photo. Add a new photo before removing this one')
  }
  listing.photos.pull(photo._id)
  await listing.save()
  await removeFile(photo.key)
  await respond(res, listing, 'Photo removed')
}))

/* ---------- Status changes ---------- */
router.post('/:id/submit', authenticate, authorize('user'), writeLimiter, asyncHandler(async (req, res) => {
  const listing = await findOwned(req)
  if (!['draft', 'changes_required'].includes(listing.status)) throw new ApiError(409, 'Only drafts or ads needing changes can be submitted')
  const category = await findCategory(listing.categoryId)
  if (!listing.photos.length && (!category || photosRequired(category))) {
    throw ApiError.validation({ photos: 'Add at least one photo before submitting' })
  }
  listing.status = 'pending_review'
  listing.moderationNote = null
  await listing.save()
  await respond(res, listing, 'Ad sent for review')
}))

router.post('/:id/withdraw', authenticate, authorize('user'), asyncHandler(async (req, res) => {
  const listing = await findOwned(req)
  assertEditable(listing)
  listing.status = 'withdrawn'
  await listing.save()
  await respond(res, listing, 'Ad withdrawn')
}))

// Puts an expired ad back online (or extends one that expires within 3 days) without a new review
router.post('/:id/renew', authenticate, authorize('user'), writeLimiter, asyncHandler(async (req, res) => {
  const listing = await findOwned(req)
  if (!canRenew(listing)) throw new ApiError(409, 'Only expired ads, or ads expiring within 3 days, can be renewed')
  const wasExpired = listing.status === 'expired'
  listing.set({ status: 'published', expiresAt: await expiryDate(), expiryReminderSentAt: null, ...(wasExpired && { publishedAt: new Date() }) })
  await listing.save()
  await respond(res, listing, 'Ad renewed')
}))

router.patch('/:id/availability', authenticate, authorize('user'), asyncHandler(async (req, res) => {
  const listing = await findOwned(req)
  const { availability } = req.body
  if (listing.status !== 'published') throw new ApiError(409, 'Only live ads can be marked as sold or rented')
  if (!['available', 'sold', 'rented'].includes(availability)) throw ApiError.validation({ availability: 'Choose a valid option' })
  if (availability === 'rented' && listing.listingType !== 'rent') throw ApiError.validation({ availability: 'Only rental ads can be marked as rented' })
  listing.availability = availability
  await listing.save()
  await respond(res, listing, 'Availability updated')
}))

export default router
