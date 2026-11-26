import redis from '../../config/redis.js'
import { notify } from '../../services/notification.service.js'
import { getSettings } from '../settings/settings.service.js'
import Listing from './listing.model.js'

const DAY_MS = 24 * 60 * 60 * 1000
const REMINDER_BEFORE_MS = 3 * DAY_MS
// Ads that were live before expiry existed get at least this long before they can expire
const GRACE_FOR_OLD_ADS_MS = 7 * DAY_MS
const LOCK_KEY = 'jobs:listing-expiry'
const LOCK_SECONDS = 10 * 60
const BATCH = 200

export const expiryDate = async (from = new Date()) => new Date(from.getTime() + (await getSettings()).listings.expiryDays * DAY_MS)

/** Ads can be renewed once they expired, or in the last three days before they expire */
export const canRenew = (listing, now = Date.now()) =>
  listing.status === 'expired' || (listing.status === 'published' && listing.expiresAt && listing.expiresAt.getTime() - now <= REMINDER_BEFORE_MS)

const giveOldAdsAnExpiry = async () => {
  const days = (await getSettings()).listings.expiryDays
  const now = new Date()
  await Listing.updateMany({ status: 'published', expiresAt: null }, [
    {
      $set: {
        expiresAt: {
          $max: [{ $add: [{ $ifNull: ['$publishedAt', now] }, days * DAY_MS] }, new Date(now.getTime() + GRACE_FOR_OLD_ADS_MS)],
        },
      },
    },
  ], { updatePipeline: true })
}

const remindSoonToExpire = async () => {
  const now = new Date()
  const due = await Listing.find({ status: 'published', expiryReminderSentAt: null, expiresAt: { $gt: now, $lte: new Date(now.getTime() + REMINDER_BEFORE_MS) } })
    .select('seller title expiresAt').limit(BATCH).lean()
  for (const ad of due) {
    const claimed = await Listing.updateOne({ _id: ad._id, expiryReminderSentAt: null }, { $set: { expiryReminderSentAt: now } })
    if (!claimed.modifiedCount) continue
    await notify(ad.seller, { type: 'listing_expiring', title: 'Your ad expires soon', body: `"${ad.title}" goes offline in less than 3 days. Renew it to keep it live.`, link: '/account/listings?status=published' })
  }
}

const expireDue = async () => {
  const due = await Listing.find({ status: 'published', expiresAt: { $lte: new Date() } }).select('seller title').limit(BATCH).lean()
  for (const ad of due) {
    const changed = await Listing.updateOne({ _id: ad._id, status: 'published' }, { $set: { status: 'expired' } })
    if (!changed.modifiedCount) continue
    await notify(ad.seller, { type: 'listing_expired', title: 'Your ad has expired', body: `"${ad.title}" is no longer live. Renew it with one click.`, link: '/account/listings?status=expired' })
  }
}

// Ended promotions are cleared so they stop sorting first
const endPromotions = () => Listing.updateMany({ featuredUntil: { $lte: new Date() } }, { $set: { featuredUntil: null } })

/** One run of the expiry job. A Redis lock makes sure only one server runs it at a time */
export const runExpiryJob = async () => {
  const locked = await redis.set(LOCK_KEY, String(process.pid), 'EX', LOCK_SECONDS, 'NX')
  if (!locked) return
  try {
    await giveOldAdsAnExpiry()
    await remindSoonToExpire()
    await expireDue()
    await endPromotions()
  } finally {
    await redis.del(LOCK_KEY)
  }
}
