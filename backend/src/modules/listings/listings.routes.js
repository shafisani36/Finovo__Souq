import crypto from 'node:crypto'
import { Router } from 'express'
import authenticate, { optionalAuthenticate } from '../../middleware/authenticate.js'
import authorize from '../../middleware/authorize.js'
import { listingPhotosUpload } from '../../middleware/upload.js'
import { uploadLimiter, writeLimiter } from '../../middleware/rateLimiter.js'
import redis from '../../config/redis.js'
import { findCategory } from '../../config/catalog.js'
import asyncHandler from '../../utils/asyncHandler.js'
import ApiResponse from '../../utils/ApiResponse.js'
import ApiError from '../../utils/ApiError.js'
import { escapeRegex, getPagination, paginated, toText } from '../../utils/pagination.js'
import { saveImage, removeFile } from '../../services/storage.service.js'
import Listing, { LOCKED_STATUSES, PUBLIC_FILTER } from './listing.model.js'
import DailyStat from './dailyStat.model.js'
import { toListingView, toListingViews } from './listing.view.js'
import { validateListing } from './listing.validation.js'

const MAX_PHOTOS = 10
const VIEW_DEDUPE_SECONDS = 30 * 60
const SORTS = { newest: { publishedAt: -1 }, price_asc: { price: 1 }, price_desc: { price: -1 } }

export const searchRouter = Router()
const router = Router()

/* ---------- Public search ---------- */
searchRouter.get('/listings', asyncHandler(async (req, res) => {
  const filter = { ...PUBLIC_FILTER }
  const q = toText(req.query.q).slice(0, 100)
  const category = findCategory(toText(req.query.category))
  const minPrice = Number(req.query.minPrice)
  const maxPrice = Number(req.query.maxPrice)

  if (q) filter.$or = [{ title: new RegExp(escapeRegex(q), 'i') }, { description: new RegExp(escapeRegex(q), 'i') }]
  if (category) filter.categoryId = category.id
  if (req.query.city) filter.city = toText(req.query.city)
  if (minPrice > 0 || maxPrice > 0) filter.price = { ...(minPrice > 0 && { $gte: minPrice }), ...(maxPrice > 0 && { $lte: maxPrice }) }

  const pagination = getPagination(req.query)
  const [docs, total] = await Promise.all([
    Listing.find(filter).sort(SORTS[req.query.sort] ?? SORTS.newest).skip(pagination.skip).limit(pagination.pageSize),
    Listing.countDocuments(filter),
  ])
  res.json(new ApiResponse(200, paginated(await toListingViews(docs), total, pagination)))
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

router.post('/', authenticate, authorize('user'), writeLimiter, asyncHandler(async (req, res) => {
  if (req.user.accountType !== 'seller') throw new ApiError(403, 'Only seller accounts can post ads')
  const listing = await Listing.create({ ...validateListing(req.body), seller: req.user.id })
  await respond(res, listing, 'Draft saved', 201)
}))

router.patch('/:id', authenticate, authorize('user'), writeLimiter, asyncHandler(async (req, res) => {
  const listing = await findOwned(req)
  assertEditable(listing)
  const current = listing.toObject()
  listing.set(validateListing({ ...current, ...req.body, attributes: req.body.attributes ?? current.attributes }))
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
  if (listing.photos.length + files.length > MAX_PHOTOS) throw ApiError.validation({ photos: `An ad can have up to ${MAX_PHOTOS} photos` })

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
  const isService = findCategory(listing.categoryId)?.slug === 'services'
  if (listing.status !== 'draft' && listing.photos.length === 1 && !isService) {
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
  if (!listing.photos.length && findCategory(listing.categoryId)?.slug !== 'services') {
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
