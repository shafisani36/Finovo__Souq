import { randomBytes } from 'node:crypto'
import { Router } from 'express'
import authenticate from '../../middleware/authenticate.js'
import authorize from '../../middleware/authorize.js'
import { uploadLimiter, writeLimiter } from '../../middleware/rateLimiter.js'
import { storeLogoUpload } from '../../middleware/upload.js'
import { SAUDI_CITIES } from '../../config/catalog.js'
import { notify } from '../../services/notification.service.js'
import { publicUrl, removeFile, saveImage } from '../../services/storage.service.js'
import ApiError from '../../utils/ApiError.js'
import ApiResponse from '../../utils/ApiResponse.js'
import asyncHandler from '../../utils/asyncHandler.js'
import { toText } from '../../utils/pagination.js'
import { slugify } from '../categories/category.validation.js'
import Listing, { PUBLIC_FILTER } from '../listings/listing.model.js'
import User from '../users/user.model.js'
import Store from './store.model.js'

/** Public view: never the commercial registration number or the review note */
export const toPublicStore = (store, activeListings) => ({
  id: store._id.toString(),
  slug: store.slug,
  name: store.name,
  description: store.description,
  city: store.city,
  logoUrl: publicUrl(store.logoKey),
  sellerId: store.owner.toString(),
  verifiedAt: store.verifiedAt,
  ...(activeListings !== undefined && { activeListings }),
})

/** Owner and admin view */
export const toStoreView = (store) => ({
  ...toPublicStore(store),
  commercialRegistration: store.commercialRegistration,
  status: store.status,
  reviewNote: store.reviewNote,
  createdAt: store.createdAt,
  updatedAt: store.updatedAt,
})

const validate = (body, { partial = false } = {}) => {
  const errors = {}
  const data = {}
  if (!partial || body.name !== undefined) {
    data.name = toText(body.name).replace(/\s+/g, ' ')
    if (data.name.length < 2 || data.name.length > 60) errors.name = 'Store name must be 2 to 60 characters'
  }
  if (body.description !== undefined) {
    data.description = toText(body.description)
    if (data.description.length > 1000) errors.description = 'Keep the description under 1,000 characters'
  }
  if (!partial || body.city !== undefined) {
    data.city = toText(body.city) || null
    if (data.city && !SAUDI_CITIES.includes(data.city)) errors.city = 'Choose a city from the list'
  }
  if (!partial || body.commercialRegistration !== undefined) {
    data.commercialRegistration = toText(body.commercialRegistration).replace(/\s/g, '')
    if (!/^\d{10}$/.test(data.commercialRegistration)) errors.commercialRegistration = 'Enter the 10-digit commercial registration number'
  }
  if (Object.keys(errors).length) throw ApiError.validation(errors)
  return data
}

// Arabic names give an empty slug, so a short random one is used instead
const uniqueSlug = async (name) => {
  // "mine" is the owner's own address (/stores/mine)
  const base = !slugify(name) || slugify(name) === 'mine' ? 'store' : slugify(name)
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = attempt === 0 && base !== 'store' ? base : `${base}-${randomBytes(3).toString('hex')}`
    if (!(await Store.exists({ slug }))) return slug
  }
  throw new ApiError(409, 'Please try a different store name')
}

const notifyAdmins = async (title, body) => {
  const admins = await User.find({ role: 'admin', status: 'active' }).select('_id').lean()
  await Promise.all(admins.map((a) => notify(a._id, { type: 'system', title, body, link: '/admin/stores?status=pending' })))
}

const router = Router()

/* ---------- Public store page ---------- */
router.get('/:slug', asyncHandler(async (req, res) => {
  const store = await Store.findOne({ slug: toText(req.params.slug).toLowerCase(), status: 'verified' })
  if (!store) throw ApiError.notFound('This store could not be found')
  const owner = await User.exists({ _id: store.owner, status: 'active' })
  if (!owner) throw ApiError.notFound('This store could not be found')
  res.json(new ApiResponse(200, toPublicStore(store, await Listing.countDocuments({ ...PUBLIC_FILTER, seller: store.owner }))))
}))

export default router

/* ---------- The seller's own store ---------- */
export const myStoreRouter = Router()
myStoreRouter.use(authenticate, authorize('user'))

const sellerOnly = (req) => {
  if (req.user.accountType !== 'seller') throw new ApiError(403, 'Only seller accounts can open a store')
}

myStoreRouter.get('/', asyncHandler(async (req, res) => {
  const store = await Store.findOne({ owner: req.user.id })
  res.json(new ApiResponse(200, store ? toStoreView(store) : null))
}))

myStoreRouter.post('/', writeLimiter, asyncHandler(async (req, res) => {
  sellerOnly(req)
  if (await Store.exists({ owner: req.user.id })) throw new ApiError(409, 'You already have a store')
  const data = validate(req.body)
  const store = await Store.create({ ...data, owner: req.user.id, slug: await uniqueSlug(data.name) })
  await notifyAdmins('New store to verify', `"${store.name}" asked for a verified business page.`)
  res.status(201).json(new ApiResponse(201, toStoreView(store), 'Store sent for verification'))
}))

myStoreRouter.patch('/', writeLimiter, asyncHandler(async (req, res) => {
  const store = await Store.findOne({ owner: req.user.id })
  if (!store) throw ApiError.notFound('You do not have a store yet')
  if (store.status === 'suspended') throw new ApiError(409, 'This store is suspended. Contact us to restore it.')
  const data = validate(req.body, { partial: true })

  // A new name or CR number must be checked again before the page is public
  const needsReview = (data.name && data.name !== store.name) || (data.commercialRegistration && data.commercialRegistration !== store.commercialRegistration)
  store.set(data)
  if (needsReview || store.status === 'rejected') {
    store.set({ status: 'pending', reviewNote: null, verifiedAt: null })
    await notifyAdmins('Store to verify', `"${store.name}" changed its details and needs checking.`)
  }
  await store.save()
  res.json(new ApiResponse(200, toStoreView(store), needsReview ? 'Saved. Your store will be checked again.' : 'Store updated'))
}))

myStoreRouter.post('/logo', uploadLimiter, storeLogoUpload, asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.validation({ logo: 'Choose an image' })
  const store = await Store.findOne({ owner: req.user.id })
  if (!store) throw ApiError.notFound('You do not have a store yet')
  const saved = await saveImage(req.file.buffer, 'public/stores', 'avatar')
  const oldKey = store.logoKey
  store.logoKey = saved.key
  await store.save()
  await removeFile(oldKey)
  res.json(new ApiResponse(200, toStoreView(store), 'Logo updated'))
}))

myStoreRouter.delete('/logo', asyncHandler(async (req, res) => {
  const store = await Store.findOne({ owner: req.user.id })
  if (!store) throw ApiError.notFound('You do not have a store yet')
  const oldKey = store.logoKey
  store.logoKey = null
  await store.save()
  await removeFile(oldKey)
  res.json(new ApiResponse(200, toStoreView(store), 'Logo removed'))
}))

