import { Router } from 'express'
import authenticate from '../../middleware/authenticate.js'
import authorize from '../../middleware/authorize.js'
import { findCategory } from '../../config/catalog.js'
import asyncHandler from '../../utils/asyncHandler.js'
import ApiResponse from '../../utils/ApiResponse.js'
import ApiError from '../../utils/ApiError.js'
import { escapeRegex, getPagination, paginated, toText } from '../../utils/pagination.js'
import { env } from '../../config/env.js'
import { notify } from '../../services/notification.service.js'
import { sendMail } from '../../services/mail.service.js'
import { revokeAllUserSessions } from '../../services/session.service.js'
import { disconnectUser } from '../../realtime/socket.js'
import User from '../users/user.model.js'
import Listing from '../listings/listing.model.js'
import { toListingView, toListingViews } from '../listings/listing.view.js'
import Report, { REPORT_STATUSES, toReportView } from '../reports/report.model.js'

const router = Router()
router.use(authenticate, authorize('admin'))

const requireReason = (body) => {
  const reason = toText(body.reason)
  if (reason.length < 10 || reason.length > 500) throw ApiError.validation({ reason: 'Explain the reason in 10 to 500 characters' })
  return reason
}

const findPending = async (id) => {
  const listing = await Listing.findById(id)
  if (!listing) throw ApiError.notFound('This ad could not be found')
  if (listing.status !== 'pending_review') throw new ApiError(409, 'Only ads waiting for review can be approved or rejected')
  return listing
}

/* ---------- Moderation ---------- */
router.get('/moderation/listings', asyncHandler(async (req, res) => {
  const status = toText(req.query.status) || 'pending_review'
  const filter = status === 'all' ? {} : { status }
  const category = findCategory(toText(req.query.category))
  if (category) filter.categoryId = category.id

  const q = toText(req.query.q).slice(0, 100)
  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i')
    const sellers = await User.find({ name: pattern }).select('_id').limit(50).lean()
    filter.$or = [{ title: pattern }, { seller: { $in: sellers.map((s) => s._id) } }]
  }

  const pagination = getPagination(req.query, 10)
  const [docs, total] = await Promise.all([
    Listing.find(filter).sort({ updatedAt: 1 }).skip(pagination.skip).limit(pagination.pageSize),
    Listing.countDocuments(filter),
  ])
  res.json(new ApiResponse(200, paginated(await toListingViews(docs), total, pagination)))
}))

router.post('/listings/:id/approve', asyncHandler(async (req, res) => {
  const listing = await findPending(req.params.id)
  listing.set({ status: 'published', moderationNote: null, publishedAt: listing.publishedAt ?? new Date() })
  await listing.save()
  await notify(listing.seller, { type: 'listing_approved', title: 'Ad approved', body: `Your ad "${listing.title}" is now live.`, link: `/listings/${listing.id}` })
  res.json(new ApiResponse(200, await toListingView(listing), 'Ad approved'))
}))

// mode "changes" lets the seller fix and resubmit; otherwise the ad is rejected for good
router.post('/listings/:id/reject', asyncHandler(async (req, res) => {
  const reason = requireReason(req.body)
  const listing = await findPending(req.params.id)
  const askChanges = req.body.mode === 'changes'
  listing.set({ status: askChanges ? 'changes_required' : 'rejected', moderationNote: reason })
  await listing.save()
  await notify(listing.seller, {
    type: askChanges ? 'changes_required' : 'listing_rejected',
    title: askChanges ? 'Changes required' : 'Ad rejected',
    body: `"${listing.title}": ${reason}`,
    link: '/account/listings',
  })
  res.json(new ApiResponse(200, await toListingView(listing), askChanges ? 'Changes requested' : 'Ad rejected'))
}))

router.post('/listings/:id/hide', asyncHandler(async (req, res) => {
  const reason = requireReason(req.body)
  const listing = await Listing.findById(req.params.id)
  if (!listing) throw ApiError.notFound('This ad could not be found')
  listing.set({ status: 'hidden', moderationNote: reason })
  await listing.save()
  await notify(listing.seller, { type: 'listing_rejected', title: 'Ad hidden', body: `"${listing.title}": ${reason}`, link: '/account/listings' })
  res.json(new ApiResponse(200, await toListingView(listing), 'Ad hidden'))
}))

/* ---------- Users ---------- */
router.get('/users', asyncHandler(async (req, res) => {
  const filter = {}
  if (['user', 'admin'].includes(req.query.role)) filter.role = req.query.role
  if (['pending', 'active', 'suspended'].includes(req.query.status)) filter.status = req.query.status
  if (['buyer', 'seller'].includes(req.query.accountType)) filter.accountType = req.query.accountType
  const q = toText(req.query.q).slice(0, 100)
  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i')
    filter.$or = [{ name: pattern }, { email: pattern }, { phone: pattern }]
  }
  const pagination = getPagination(req.query, 10)
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.pageSize),
    User.countDocuments(filter),
  ])
  res.json(new ApiResponse(200, paginated(users, total, pagination)))
}))

router.post('/users/:id/approve', asyncHandler(async (req, res) => {
  const user = await User.findOneAndUpdate(
    { _id: req.params.id, status: 'pending' },
    { status: 'active' },
    { returnDocument: 'after' }
  )
  if (!user) throw new ApiError(409, 'Only accounts waiting for approval can be approved')

  // The seller cannot sign in yet, so email is the only way to tell them
  const loginUrl = `${env.CLIENT_URL}/login`
  const name = user.name.replace(/[<>&"]/g, '')
  const emailSent = await sendMail({
    to: user.email,
    subject: 'Your Finovo Souq seller account is approved',
    text: `Hi ${user.name},\n\nGood news: your seller account is approved. You can now sign in and post your ads.\n\nSign in: ${loginUrl}\n\nFinovo Souq`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#1f1d2b">
  <h2 style="color:#6c47ff;margin:0 0 16px">Finovo Souq</h2>
  <p>Hi ${name},</p>
  <p>Good news: your seller account is approved. You can now sign in and post your ads.</p>
  <p style="margin:24px 0"><a href="${loginUrl}" style="background:#6c47ff;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">Sign in</a></p>
  <p style="color:#6b6b80;font-size:13px">Every ad is checked by our team before it goes live.</p>
</div>`,
  }).then(() => true, () => false)

  res.json(new ApiResponse(200, { user, emailSent }, emailSent ? 'Seller approved and emailed' : 'Seller approved, but the email could not be sent'))
}))

router.patch('/users/:id/status', asyncHandler(async (req, res) => {
  const { status } = req.body
  if (!['active', 'suspended'].includes(status)) throw ApiError.validation({ status: 'Choose a valid status' })
  if (toText(req.body.reason).length < 5) throw ApiError.validation({ reason: 'Add a short reason' })

  const user = await User.findById(req.params.id)
  if (!user) throw ApiError.notFound('User not found')
  if (user.role === 'admin') throw new ApiError(409, 'Admin accounts cannot be suspended here')

  user.status = status
  await user.save()
  // A suspended account is signed out everywhere at once
  if (status === 'suspended') {
    await revokeAllUserSessions(user._id)
    disconnectUser(user.id)
  }
  res.json(new ApiResponse(200, user, status === 'suspended' ? 'User suspended' : 'User reactivated'))
}))

/* ---------- Reports ---------- */
router.get('/reports', asyncHandler(async (req, res) => {
  const filter = REPORT_STATUSES.includes(req.query.status) ? { status: req.query.status } : {}
  const pagination = getPagination(req.query, 10)
  const [reports, total] = await Promise.all([
    Report.find(filter).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.pageSize)
      .populate('listing', 'title').populate('reporter', 'name'),
    Report.countDocuments(filter),
  ])
  res.json(new ApiResponse(200, paginated(reports.map(toReportView), total, pagination)))
}))

router.patch('/reports/:id/status', asyncHandler(async (req, res) => {
  if (!REPORT_STATUSES.includes(req.body.status)) throw ApiError.validation({ status: 'Choose a valid status' })
  const report = await Report.findByIdAndUpdate(req.params.id, { status: req.body.status }, { returnDocument: 'after' })
    .populate('listing', 'title').populate('reporter', 'name')
  if (!report) throw ApiError.notFound('Report not found')
  res.json(new ApiResponse(200, toReportView(report), 'Report updated'))
}))

export default router