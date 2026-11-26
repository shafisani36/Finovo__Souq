import { Router } from 'express'
import mongoose from 'mongoose'
import authenticate from '../../middleware/authenticate.js'
import authorize from '../../middleware/authorize.js'
import { getCategoryTree } from '../categories/category.tree.js'
import asyncHandler from '../../utils/asyncHandler.js'
import ApiResponse from '../../utils/ApiResponse.js'
import User from '../users/user.model.js'
import Listing, { PUBLIC_FILTER } from '../listings/listing.model.js'
import DailyStat from '../listings/dailyStat.model.js'
import { toListingViews } from '../listings/listing.view.js'
import Report, { toReportView } from '../reports/report.model.js'
import Conversation from '../chat/conversation.model.js'
import Message from '../chat/message.model.js'
import { toConversationViews } from '../chat/chat.service.js'
import { SavedListing } from '../saved/saved.model.js'

const DAY_MS = 24 * 60 * 60 * 1000
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DECIDED = ['published', 'rejected', 'changes_required', 'hidden']

/** The selected period and the start of it; "previous" values describe the account at that start */
const getRange = (query) => {
  const days = { '7d': 7, '90d': 90 }[query.range] ?? 30
  const since = new Date(Date.now() - days * DAY_MS)
  since.setUTCHours(0, 0, 0, 0)
  const dates = Array.from({ length: days }, (_, i) => new Date(since.getTime() + (i + 1) * DAY_MS).toISOString().slice(0, 10))
  return { since, dates }
}

const kpi = (key, label, value, previousValue) => ({ key, label, value, previousValue, format: 'number' })

/** Counts documents per day ("YYYY-MM-DD") for a date field */
const countPerDay = async (Model, match, field) => {
  const rows = await Model.aggregate([
    { $match: match },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: `$${field}` } }, count: { $sum: 1 } } },
  ])
  return new Map(rows.map((r) => [r._id, r.count]))
}

const router = Router()

router.get('/admin/dashboard', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
  const { since, dates } = getRange(req.query)
  const before = { $lt: since }
  const openReport = { status: { $in: ['open', 'reviewing'] } }

  const [live, liveBefore, pending, pendingBefore, users, usersBefore, reports, reportsBefore] = await Promise.all([
    Listing.countDocuments(PUBLIC_FILTER),
    Listing.countDocuments({ ...PUBLIC_FILTER, publishedAt: before }),
    Listing.countDocuments({ status: 'pending_review' }),
    Listing.countDocuments({ status: 'pending_review', updatedAt: before }),
    User.countDocuments({ status: 'active' }),
    User.countDocuments({ status: 'active', createdAt: before }),
    Report.countDocuments(openReport),
    Report.countDocuments({ ...openReport, createdAt: before }),
  ])

  const [submitted, approved, perCategory, perWeekday, decided, approvedTotal, pendingQueue, recentReports] = await Promise.all([
    countPerDay(Listing, { createdAt: { $gte: since } }, 'createdAt'),
    countPerDay(Listing, { publishedAt: { $gte: since } }, 'publishedAt'),
    // The first entry of categoryPath is the top-level category
    Listing.aggregate([{ $match: PUBLIC_FILTER }, { $group: { _id: { $arrayElemAt: ['$categoryPath', 0] }, count: { $sum: 1 } } }]),
    Listing.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: { $dayOfWeek: '$createdAt' }, count: { $sum: 1 } } }]),
    Listing.countDocuments({ status: { $in: DECIDED } }),
    Listing.countDocuments({ status: 'published' }),
    Listing.find({ status: 'pending_review' }).sort({ updatedAt: 1 }).limit(5),
    Report.find().sort({ createdAt: -1 }).limit(5).populate('listing', 'title').populate('reporter', 'name'),
  ])

  const categoryCount = new Map(perCategory.map((c) => [c._id, c.count]))
  const weekdayCount = new Map(perWeekday.map((w) => [w._id, w.count]))

  res.json(new ApiResponse(200, {
    kpis: [
      kpi('liveListings', 'Live ads', live, liveBefore),
      kpi('pendingReview', 'Pending review', pending, pendingBefore),
      kpi('activeUsers', 'Active users', users, usersBefore),
      kpi('openReports', 'Open reports', reports, reportsBefore),
    ],
    listingsTrend: dates.map((date) => ({ date, value: submitted.get(date) ?? 0 })),
    approvalsTrend: dates.map((date) => ({ date, value: approved.get(date) ?? 0 })),
    categoryBreakdown: (await getCategoryTree()).roots.map((c) => ({ slug: c.slug, name: c.name, count: categoryCount.get(c.id) ?? 0 })),
    activityByWeekday: WEEKDAYS.map((day, i) => ({ day, value: weekdayCount.get(i + 1) ?? 0 })),
    approvalRate: decided ? Math.round((approvedTotal / decided) * 100) : 0,
    pendingQueue: await toListingViews(pendingQueue),
    recentReports: recentReports.map(toReportView),
  }))
}))

router.get('/dashboard/user', authenticate, authorize('user'), asyncHandler(async (req, res) => {
  const { since, dates } = getRange(req.query)
  const userId = new mongoose.Types.ObjectId(req.user.id)
  const mine = { seller: userId }

  const [listings, savedLinks, conversations, viewStats] = await Promise.all([
    Listing.find(mine).sort({ updatedAt: -1 }),
    SavedListing.find({ user: userId }).sort({ createdAt: -1 }).lean(),
    Conversation.find({ $or: [{ buyer: userId }, { seller: userId }] }).sort({ 'lastMessage.at': -1 }),
    DailyStat.find({ seller: userId, date: { $gte: dates[0] } }).lean(),
  ])

  const received = await countPerDay(Message, { conversation: { $in: conversations.map((c) => c._id) }, sender: { $ne: userId }, createdAt: { $gte: since } }, 'createdAt')
  const viewsByDate = new Map(viewStats.map((s) => [s.date, s.views]))
  const viewsInRange = viewStats.reduce((sum, s) => sum + s.views, 0)

  const isLive = (l) => l.status === 'published' && l.availability === 'available'
  const live = listings.filter(isLive)
  const totalViews = listings.reduce((sum, l) => sum + l.views, 0)
  const savedListings = await Listing.find({ _id: { $in: savedLinks.slice(0, 20).map((s) => s.listing) }, status: 'published' }).limit(4)
  const asSeller = conversations.filter((c) => c.seller.equals(userId))
  const statuses = ['published', 'pending_review', 'changes_required', 'draft', 'rejected', 'withdrawn']

  res.json(new ApiResponse(200, {
    kpis: [
      kpi('liveListings', 'Live ads', live.length, live.filter((l) => l.publishedAt < since).length),
      kpi('totalViews', 'Total views', totalViews, totalViews - viewsInRange),
      kpi('conversations', 'Conversations', conversations.length, conversations.filter((c) => c.createdAt < since).length),
      kpi('saved', 'Saved ads', savedLinks.length, savedLinks.filter((s) => s.createdAt < since).length),
    ],
    engagement: dates.map((date) => ({ date, views: viewsByDate.get(date) ?? 0, messages: received.get(date) ?? 0 })),
    adsByStatus: statuses.map((status) => ({ status, count: listings.filter((l) => l.status === status).length })).filter((s) => s.count),
    responseRate: asSeller.length ? Math.round((asSeller.filter((c) => c.sellerRepliedAt).length / asSeller.length) * 100) : 0,
    myListings: await toListingViews(listings.slice(0, 6)),
    actionRequired: await toListingViews(listings.filter((l) => ['changes_required', 'draft'].includes(l.status))),
    recentConversations: await toConversationViews(conversations.slice(0, 4), req.user.id),
    savedListings: await toListingViews(savedListings),
  }))
}))

export default router
