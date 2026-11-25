import { Router } from 'express'
import { CATEGORIES } from '../../config/catalog.js'
import asyncHandler from '../../utils/asyncHandler.js'
import ApiResponse from '../../utils/ApiResponse.js'
import Listing, { PUBLIC_FILTER } from '../listings/listing.model.js'

const router = Router()

router.get('/', asyncHandler(async (req, res) => {
  const counts = await Listing.aggregate([{ $match: PUBLIC_FILTER }, { $group: { _id: '$categoryId', count: { $sum: 1 } } }])
  const countById = new Map(counts.map((c) => [c._id, c.count]))
  res.json(new ApiResponse(200, CATEGORIES.map((c) => ({ ...c, listingCount: countById.get(c.id) ?? 0 }))))
}))

export default router
