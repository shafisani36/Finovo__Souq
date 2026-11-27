import Conversation from '../chat/conversation.model.js'
import Store from '../stores/store.model.js'
import Listing from './listing.model.js'

const WINDOW_DAYS = 90
// Below this many buyer conversations, a reply time would say more about luck than habit
const MIN_CONVERSATIONS = 3
const HOUR = 60 * 60 * 1000

const replySpeed = (medianMs) => {
  if (medianMs <= HOUR) return 'within_hour'
  if (medianMs <= 6 * HOUR) return 'within_hours'
  if (medianMs <= 24 * HOUR) return 'within_day'
  return 'slow'
}

/**
 * Facts a buyer can use to judge a seller, all taken from what happened on Finovo Souq:
 * ads sold, how often and how fast the seller answers new buyers in the last 90 days, and a verified store.
 */
export const getSellerTrust = async (sellerId) => {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * HOUR)
  const [itemsSold, conversations, store] = await Promise.all([
    Listing.countDocuments({ seller: sellerId, status: 'published', availability: { $in: ['sold', 'rented'] } }),
    Conversation.find({ seller: sellerId, createdAt: { $gte: since } }).select('createdAt sellerRepliedAt').sort({ createdAt: -1 }).limit(200).lean(),
    Store.findOne({ owner: sellerId, status: 'verified' }).select('name slug').lean(),
  ])

  const replyTimes = conversations
    .filter((c) => c.sellerRepliedAt)
    .map((c) => c.sellerRepliedAt - c.createdAt)
    .sort((a, b) => a - b)
  const enough = conversations.length >= MIN_CONVERSATIONS

  return {
    itemsSold,
    replyRate: enough ? Math.round((replyTimes.length / conversations.length) * 100) : null,
    replySpeed: enough && replyTimes.length ? replySpeed(replyTimes[Math.floor(replyTimes.length / 2)]) : null,
    // A business whose commercial registration our team has checked
    business: store ? { name: store.name, slug: store.slug } : null,
  }
}
