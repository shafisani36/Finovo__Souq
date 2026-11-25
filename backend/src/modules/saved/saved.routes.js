import { Router } from 'express'
import authenticate from '../../middleware/authenticate.js'
import authorize from '../../middleware/authorize.js'
import { writeLimiter } from '../../middleware/rateLimiter.js'
import asyncHandler from '../../utils/asyncHandler.js'
import ApiResponse from '../../utils/ApiResponse.js'
import ApiError from '../../utils/ApiError.js'
import { toText } from '../../utils/pagination.js'
import Listing, { PUBLIC_FILTER } from '../listings/listing.model.js'
import { toListingViews } from '../listings/listing.view.js'
import { SavedListing, SavedSearch } from './saved.model.js'

const MAX_SAVED_SEARCHES = 20
const CRITERIA_KEYS = ['q', 'city', 'category', 'minPrice', 'maxPrice', 'sort']

const router = Router()
// Applied per route: this router shares the /users/me prefix with the profile routes
const member = [authenticate, authorize('user')]

router.get('/saved-listings', member, asyncHandler(async (req, res) => {
  const saved = await SavedListing.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(200).lean()
  const listings = await Listing.find({ _id: { $in: saved.map((s) => s.listing) }, status: 'published' })
  const byId = new Map(listings.map((l) => [l.id, l]))
  const ordered = saved.map((s) => byId.get(s.listing.toString())).filter(Boolean)
  res.json(new ApiResponse(200, await toListingViews(ordered)))
}))

router.post('/saved-listings/:listingId', member, writeLimiter, asyncHandler(async (req, res) => {
  const listing = await Listing.exists({ _id: req.params.listingId, ...PUBLIC_FILTER })
  if (!listing) throw new ApiError(409, 'This ad is no longer available')
  await SavedListing.updateOne({ user: req.user.id, listing: listing._id }, {}, { upsert: true })
  res.status(201).json(new ApiResponse(201, null, 'Ad saved'))
}))

router.delete('/saved-listings/:listingId', member, asyncHandler(async (req, res) => {
  await SavedListing.deleteOne({ user: req.user.id, listing: req.params.listingId })
  res.json(new ApiResponse(200, null, 'Ad removed from saved'))
}))

router.get('/saved-searches', member, asyncHandler(async (req, res) => {
  res.json(new ApiResponse(200, await SavedSearch.find({ user: req.user.id }).sort({ createdAt: -1 })))
}))

router.post('/saved-searches', member, writeLimiter, asyncHandler(async (req, res) => {
  const label = toText(req.body.label).slice(0, 80)
  if (!label) throw ApiError.validation({ label: 'Give this search a name' })
  if (await SavedSearch.countDocuments({ user: req.user.id }) >= MAX_SAVED_SEARCHES) {
    throw new ApiError(409, `You can keep up to ${MAX_SAVED_SEARCHES} saved searches`)
  }
  const source = req.body.criteria && typeof req.body.criteria === 'object' ? req.body.criteria : {}
  const criteria = Object.fromEntries(CRITERIA_KEYS.filter((k) => source[k] !== undefined && source[k] !== '').map((k) => [k, String(source[k]).slice(0, 100)]))
  const search = await SavedSearch.create({ user: req.user.id, label, criteria })
  res.status(201).json(new ApiResponse(201, search, 'Search saved'))
}))

router.delete('/saved-searches/:id', member, asyncHandler(async (req, res) => {
  await SavedSearch.deleteOne({ _id: req.params.id, user: req.user.id })
  res.json(new ApiResponse(200, null, 'Search deleted'))
}))

export default router
