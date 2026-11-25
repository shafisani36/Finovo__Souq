import { Router } from 'express'
import authenticate from '../../middleware/authenticate.js'
import authorize from '../../middleware/authorize.js'
import { writeLimiter } from '../../middleware/rateLimiter.js'
import asyncHandler from '../../utils/asyncHandler.js'
import ApiResponse from '../../utils/ApiResponse.js'
import ApiError from '../../utils/ApiError.js'
import { toText } from '../../utils/pagination.js'
import Listing from '../listings/listing.model.js'
import Report, { REPORT_REASONS, toReportView } from './report.model.js'

const router = Router()

// Mounted at /listings; anyone signed in can report an ad that is not their own
router.post('/:id/reports', authenticate, authorize('user'), writeLimiter, asyncHandler(async (req, res) => {
  const listing = await Listing.findOne({ _id: req.params.id, status: 'published' }).select('seller title')
  if (!listing) throw ApiError.notFound('This ad could not be found')
  if (listing.seller.toString() === req.user.id) throw new ApiError(409, 'You cannot report your own ad')
  if (!REPORT_REASONS.includes(req.body.reason)) throw ApiError.validation({ reason: 'Choose a reason' })

  const report = await Report.create({
    listing: listing._id,
    reporter: req.user.id,
    reason: req.body.reason,
    details: toText(req.body.details).slice(0, 1000) || null,
  }).catch((error) => {
    if (error.code === 11000) throw new ApiError(409, 'You have already reported this ad')
    throw error
  })
  await report.populate([{ path: 'listing', select: 'title' }, { path: 'reporter', select: 'name' }])
  res.status(201).json(new ApiResponse(201, toReportView(report), 'Report received'))
}))

export default router
