import { notify } from '../../services/notification.service.js'
import { errorFields, logger } from '../../utils/logger.js'
import { getCategoryTree } from '../categories/category.tree.js'
import { SavedListing, SavedSearch } from '../saved/saved.model.js'
import { matchesCriteria } from './savedSearch.matcher.js'

// One alert per saved search per hour, however many matching ads are approved
const SEARCH_ALERT_COOLDOWN_MS = 60 * 60 * 1000
const BATCH_SIZE = 500

const formatSar = (n) => `SAR ${Number(n).toLocaleString('en-US')}`

/** Tells owners of matching saved searches that a new ad is live; never the seller of the ad */
export const alertSavedSearches = async (listing) => {
  const tree = await getCategoryTree()
  const bySlug = (slug) => tree.bySlug.get(slug)
  const cutoff = new Date(Date.now() - SEARCH_ALERT_COOLDOWN_MS)
  const cursor = SavedSearch.find({
    alertsEnabled: { $ne: false },
    user: { $ne: listing.seller },
    $or: [{ lastAlertAt: null }, { lastAlertAt: { $lt: cutoff } }],
  }).lean().cursor({ batchSize: BATCH_SIZE })

  for await (const search of cursor) {
    if (!matchesCriteria(search.criteria ?? {}, listing, bySlug)) continue
    // Claim the slot atomically, so two approvals at once cannot send two alerts
    const claimed = await SavedSearch.updateOne(
      { _id: search._id, $or: [{ lastAlertAt: null }, { lastAlertAt: { $lt: cutoff } }] },
      { $set: { lastAlertAt: new Date() } }
    )
    if (!claimed.modifiedCount) continue
    await notify(search.user, {
      type: 'saved_search_match',
      title: `New ad for "${search.label}"`,
      body: `${listing.title} · ${formatSar(listing.price)} · ${listing.city}`,
      link: `/listings/${listing._id}`,
    })
  }
}

/** Tells people who saved an ad that its price went down since it was last approved */
export const alertPriceDrop = async (listing, previousPrice) => {
  if (!(previousPrice > listing.price)) return
  const savers = await SavedListing.find({ listing: listing._id }).select('user').lean()
  await Promise.all(savers.map((s) => notify(s.user, {
    type: 'price_drop',
    title: 'Price drop on a saved ad',
    body: `${listing.title}: now ${formatSar(listing.price)} (was ${formatSar(previousPrice)})`,
    link: `/listings/${listing._id}`,
  })))
}

/** Runs alerts after the response is sent; a failed alert must never undo an approval */
export const runInBackground = (task, label) => {
  task().catch((error) => logger.error(`${label} failed`, errorFields(error)))
}
