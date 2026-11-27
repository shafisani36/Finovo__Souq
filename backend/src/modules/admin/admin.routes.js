import { Router } from 'express'
import { isValidObjectId } from 'mongoose'
import authenticate from '../../middleware/authenticate.js'
import authorize from '../../middleware/authorize.js'
import { findCategory } from '../categories/category.tree.js'
import { adminCategoryRouter } from '../categories/categories.routes.js'
import { adminSettingsRouter } from '../settings/settings.routes.js'
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
import Listing, { PUBLIC_FILTER } from '../listings/listing.model.js'
import { toListingView, toListingViews } from '../listings/listing.view.js'
import Report, { REPORT_STATUSES, toReportView } from '../reports/report.model.js'
import ModerationLog from './moderationLog.model.js'
import { alertPriceDrop, alertSavedSearches, runInBackground } from '../alerts/alerts.service.js'
import { expiryDate } from '../listings/listing.expiry.js'
import { deleteAccount } from '../users/accountDeletion.service.js'
import Payment, { PAYMENT_STATUSES } from '../payments/payment.model.js'
import { approvePromotion, rejectPromotion, toPaymentView } from '../payments/payments.service.js'
import { PROMOTION_DAYS } from '../settings/settings.validation.js'
import Store, { STORE_STATUSES } from '../stores/store.model.js'
import { toStoreView } from '../stores/stores.routes.js'

const router = Router()
router.use(authenticate, authorize('admin'))

const requireReason = (body) => {
  const reason = toText(body.reason)
  if (reason.length < 10 || reason.length > 500) throw ApiError.validation({ reason: 'Explain the reason in 10 to 500 characters' })
  return reason
}

const logAction = (req, entry) => ModerationLog.create({ admin: req.user.id, ...entry })

const findPending = async (id) => {
  const listing = await Listing.findById(id)
  if (!listing) throw ApiError.notFound('This ad could not be found')
  if (listing.status !== 'pending_review') throw new ApiError(409, 'Only ads waiting for review can be approved or rejected')
  return listing
}

router.use('/categories', adminCategoryRouter)
router.use('/settings', adminSettingsRouter)

/* ---------- Moderation ---------- */
router.get('/moderation/listings', asyncHandler(async (req, res) => {
  const status = toText(req.query.status) || 'pending_review'
  const filter = status === 'all' ? {} : { status }
  const category = await findCategory(toText(req.query.category))
  if (category) filter.categoryPath = category.id

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
  const isFirstApproval = !listing.publishedAt
  const previousPrice = listing.publishedPrice
  listing.set({
    status: 'published',
    moderationNote: null,
    publishedAt: listing.publishedAt ?? new Date(),
    // An edited ad keeps its remaining time; a new one gets the full period
    expiresAt: listing.expiresAt && listing.expiresAt > new Date() ? listing.expiresAt : await expiryDate(),
    expiryReminderSentAt: null,
    publishedPrice: listing.price,
  })
  await listing.save()
  await logAction(req, { action: 'listing_approved', listing: listing._id, previousStatus: 'pending_review', newStatus: 'published' })
  await notify(listing.seller, { type: 'listing_approved', title: 'Ad approved', body: `Your ad "${listing.title}" is now live.`, link: `/listings/${listing.id}` })
  const approved = listing.toObject()
  runInBackground(() => (isFirstApproval ? alertSavedSearches(approved) : alertPriceDrop(approved, previousPrice)), 'Ad alerts')
  res.json(new ApiResponse(200, await toListingView(listing), 'Ad approved'))
}))

// mode "changes" lets the seller fix and resubmit; otherwise the ad is rejected for good
router.post('/listings/:id/reject', asyncHandler(async (req, res) => {
  const reason = requireReason(req.body)
  const listing = await findPending(req.params.id)
  const askChanges = req.body.mode === 'changes'
  listing.set({ status: askChanges ? 'changes_required' : 'rejected', moderationNote: reason })
  await listing.save()
  await logAction(req, {
    action: askChanges ? 'listing_changes_requested' : 'listing_rejected',
    listing: listing._id,
    reason,
    previousStatus: 'pending_review',
    newStatus: listing.status,
  })
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
  if (listing.status === 'hidden') throw new ApiError(409, 'This ad is already hidden')
  const previousStatus = listing.status
  listing.set({ status: 'hidden', moderationNote: reason })
  await listing.save()
  await logAction(req, { action: 'listing_hidden', listing: listing._id, reason, previousStatus, newStatus: 'hidden' })
  await notify(listing.seller, { type: 'listing_rejected', title: 'Ad hidden', body: `"${listing.title}": ${reason}`, link: '/account/listings' })
  res.json(new ApiResponse(200, await toListingView(listing), 'Ad hidden'))
}))

/* ---------- Promotions ---------- */
const DAY_MS = 24 * 60 * 60 * 1000

router.get('/promotions', asyncHandler(async (req, res) => {
  const docs = await Listing.find({ ...PUBLIC_FILTER, featuredUntil: { $gt: new Date() } }).sort({ featuredUntil: 1 }).limit(100)
  res.json(new ApiResponse(200, await toListingViews(docs)))
}))

// Paid promotions bought by sellers through Stripe; pending checkouts are hidden unless asked for
router.get('/payments', asyncHandler(async (req, res) => {
  const filter = PAYMENT_STATUSES.includes(req.query.status) ? { status: req.query.status } : { status: { $ne: 'pending' } }
  const pagination = getPagination(req.query, 20)
  const [items, total] = await Promise.all([
    Payment.find(filter).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.pageSize)
      .populate('user', 'name email').populate('listing', 'title').lean(),
    Payment.countDocuments(filter),
  ])
  res.json(new ApiResponse(200, paginated(items.map(toPaymentView), total, pagination)))
}))

router.post('/payments/:id/approve', asyncHandler(async (req, res) => {
  const payment = await approvePromotion(req.params.id, req.user.id)
  await logAction(req, { action: 'promotion_approved', listing: payment.listing, reason: `${payment.days} days, invoice ${payment.invoiceNumber}`, previousStatus: 'paid', newStatus: 'approved' })
  res.json(new ApiResponse(200, toPaymentView(payment), 'Promotion approved, the ad is featured'))
}))

router.post('/payments/:id/reject', asyncHandler(async (req, res) => {
  const reason = toText(req.body.reason).slice(0, 300)
  if (reason.length < 5) throw ApiError.validation({ reason: 'Tell the seller why, in a few words' })
  const payment = await rejectPromotion(req.params.id, req.user.id, reason)
  await logAction(req, { action: 'promotion_rejected', listing: payment.listing, reason, previousStatus: 'paid', newStatus: 'refunded' })
  res.json(new ApiResponse(200, toPaymentView(payment), 'Promotion rejected and refunded'))
}))

/* ---------- Business stores ---------- */
router.get('/stores', asyncHandler(async (req, res) => {
  const filter = STORE_STATUSES.includes(req.query.status) ? { status: req.query.status } : {}
  const q = toText(req.query.q)
  if (q) filter.$or = [{ name: { $regex: escapeRegex(q), $options: 'i' } }, { commercialRegistration: q }]
  const pagination = getPagination(req.query, 20)
  const [stores, total] = await Promise.all([
    Store.find(filter).sort({ status: 1, createdAt: -1 }).skip(pagination.skip).limit(pagination.pageSize).populate('owner', 'name email').lean(),
    Store.countDocuments(filter),
  ])
  const items = stores.map((s) => ({ ...toStoreView({ ...s, owner: s.owner?._id ?? s.owner }), owner: s.owner?.name ? { id: s.owner._id.toString(), name: s.owner.name, email: s.owner.email } : null }))
  res.json(new ApiResponse(200, paginated(items, total, pagination)))
}))

const STORE_DECISIONS = {
  verify: { from: ['pending', 'rejected', 'suspended'], to: 'verified', action: 'store_verified', title: 'Your store is verified', needsReason: false },
  reject: { from: ['pending'], to: 'rejected', action: 'store_rejected', title: 'Your store needs changes', needsReason: true },
  suspend: { from: ['verified'], to: 'suspended', action: 'store_suspended', title: 'Your store has been suspended', needsReason: true },
}

router.post('/stores/:id/:decision', asyncHandler(async (req, res) => {
  const decision = STORE_DECISIONS[req.params.decision]
  if (!decision || !isValidObjectId(req.params.id)) throw ApiError.notFound('Not found')
  const reason = toText(req.body.reason).slice(0, 300)
  if (decision.needsReason && reason.length < 5) throw ApiError.validation({ reason: 'Tell the seller why, in a few words' })

  const store = await Store.findById(req.params.id)
  if (!store) throw ApiError.notFound('This store could not be found')
  if (!decision.from.includes(store.status)) throw new ApiError(409, `A ${store.status} store cannot be changed this way`)

  const previousStatus = store.status
  store.set({ status: decision.to, reviewNote: reason || null, verifiedAt: decision.to === 'verified' ? new Date() : store.verifiedAt })
  await store.save()
  await logAction(req, { action: decision.action, user: store.owner, reason: reason || `Store "${store.name}"`, previousStatus, newStatus: decision.to })
  await notify(store.owner, {
    type: 'system',
    title: decision.title,
    body: decision.to === 'verified' ? `"${store.name}" now shows a Verified business badge.` : reason,
    link: '/account/store',
  })
  res.json(new ApiResponse(200, toStoreView(store)))
}))

// Free promotion by the team
router.post('/listings/:id/feature', asyncHandler(async (req, res) => {
  const days = Number(req.body.days)
  if (!PROMOTION_DAYS.includes(days)) throw ApiError.validation({ days: `Choose ${PROMOTION_DAYS.join(', ')} days` })
  const listing = await Listing.findOne({ _id: req.params.id, ...PUBLIC_FILTER })
  if (!listing) throw new ApiError(409, 'Only live, available ads can be featured')

  // Extending a running promotion adds to it instead of restarting it
  const from = listing.featuredUntil && listing.featuredUntil > new Date() ? listing.featuredUntil : new Date()
  listing.featuredUntil = new Date(from.getTime() + days * DAY_MS)
  await listing.save()
  await logAction(req, { action: 'listing_featured', listing: listing._id, reason: `${days} days`, previousStatus: 'published', newStatus: 'published' })
  await notify(listing.seller, { type: 'listing_featured', title: 'Your ad is featured', body: `"${listing.title}" is shown at the top of search for ${days} days.`, link: `/listings/${listing.id}` })
  res.json(new ApiResponse(200, await toListingView(listing), 'Ad featured'))
}))

router.delete('/listings/:id/feature', asyncHandler(async (req, res) => {
  const listing = await Listing.findOneAndUpdate(
    { _id: req.params.id, featuredUntil: { $gt: new Date() } },
    { featuredUntil: null },
    { returnDocument: 'after' }
  )
  if (!listing) throw new ApiError(409, 'This ad is not featured')
  await logAction(req, { action: 'listing_unfeatured', listing: listing._id, previousStatus: listing.status, newStatus: listing.status })
  res.json(new ApiResponse(200, await toListingView(listing), 'Promotion stopped'))
}))

/* ---------- Users ---------- */
router.get('/users', asyncHandler(async (req, res) => {
  const filter = {}
  if (['user', 'admin'].includes(req.query.role)) filter.role = req.query.role
  if (['pending', 'active', 'suspended', 'deleted'].includes(req.query.status)) filter.status = req.query.status
  if (req.query.deletion === 'requested') filter.deletionRequestedAt = { $type: 'date' }
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
  await logAction(req, { action: 'seller_approved', user: user._id, previousStatus: 'pending', newStatus: 'active' })

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
  const reason = toText(req.body.reason).slice(0, 500)
  if (!['active', 'suspended'].includes(status)) throw ApiError.validation({ status: 'Choose a valid status' })
  if (reason.length < 5) throw ApiError.validation({ reason: 'Add a short reason' })

  const user = await User.findById(req.params.id)
  if (!user) throw ApiError.notFound('User not found')
  if (user.role === 'admin') throw new ApiError(409, 'Admin accounts cannot be suspended here')
  if (user.status === 'deleted') throw new ApiError(409, 'This account has been deleted')
  if (user.status === status) throw new ApiError(409, `This account is already ${status}`)

  const previousStatus = user.status
  user.status = status
  await user.save()
  await logAction(req, { action: status === 'suspended' ? 'user_suspended' : 'user_reactivated', user: user._id, reason, previousStatus, newStatus: status })
  // A suspended account is signed out everywhere at once
  if (status === 'suspended') {
    await revokeAllUserSessions(user._id)
    disconnectUser(user.id)
  }
  res.json(new ApiResponse(200, user, status === 'suspended' ? 'User suspended' : 'User reactivated'))
}))

// Permanent: personal details, ads, photos and chat messages are erased
router.post('/users/:id/delete', asyncHandler(async (req, res) => {
  const reason = toText(req.body.reason).slice(0, 500)
  if (reason.length < 5) throw ApiError.validation({ reason: 'Add a short reason' })
  const user = await User.findById(req.params.id)
  if (!user) throw ApiError.notFound('User not found')
  if (user.role === 'admin') throw new ApiError(409, 'Admin accounts cannot be deleted here')
  if (user.status === 'deleted') throw new ApiError(409, 'This account is already deleted')

  const previousStatus = user.status
  await deleteAccount(user)
  await logAction(req, { action: 'user_deleted', user: user._id, reason, previousStatus, newStatus: 'deleted' })
  res.json(new ApiResponse(200, await User.findById(user._id), 'Account deleted'))
}))

/* ---------- Moderation history ---------- */
router.get('/history', asyncHandler(async (req, res) => {
  const filter = {}
  if (req.query.type === 'listings') filter.listing = { $ne: null }
  if (req.query.type === 'users') filter.user = { $ne: null }
  const pagination = getPagination(req.query, 20)
  const [entries, total] = await Promise.all([
    ModerationLog.find(filter).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.pageSize)
      .populate('admin', 'name').populate('listing', 'title').populate('user', 'name email'),
    ModerationLog.countDocuments(filter),
  ])
  res.json(new ApiResponse(200, paginated(entries, total, pagination)))
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
