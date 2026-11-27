import Setting, { PAGE_SLUGS } from './setting.model.js'
import { DEFAULT_SETTINGS } from './settings.defaults.js'
import { ARABIC_PAGES } from './settings.pages.ar.js'
import { paymentsAvailable } from '../../services/stripe.service.js'

const CACHE_TTL_MS = 60_000
let cached = null

// Settings added in a later release get their default value once, without touching what admins already changed
const addMissingDefaults = async (doc) => {
  const $set = {}
  for (const slug of PAGE_SLUGS) {
    const page = doc.pages?.[slug]
    if (!page) $set[`pages.${slug}`] = { ...DEFAULT_SETTINGS.pages[slug], titleAr: ARABIC_PAGES[slug].title, bodyAr: ARABIC_PAGES[slug].body, updatedAt: new Date() }
    // Pages saved before Arabic existed get the Arabic text only if the English text is still ours
    else if (page.bodyAr === undefined && page.body === DEFAULT_SETTINGS.pages[slug].body) {
      $set[`pages.${slug}.titleAr`] = ARABIC_PAGES[slug].title
      $set[`pages.${slug}.bodyAr`] = ARABIC_PAGES[slug].body
    }
  }
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS.listings)) if (doc.listings?.[key] === undefined) $set[`listings.${key}`] = value
  if (!doc.promotions?.packages) $set.promotions = DEFAULT_SETTINGS.promotions
  if (!Object.keys($set).length) return doc
  return Setting.findOneAndUpdate({ key: 'site' }, { $set }, { returnDocument: 'after', lean: true })
}

/** The settings document, created with the defaults on first use and kept in memory for a minute */
export const getSettings = async () => {
  if (!cached || Date.now() - cached.loadedAt > CACHE_TTL_MS) {
    const load = () => Setting.findOneAndUpdate({ key: 'site' }, { $setOnInsert: DEFAULT_SETTINGS }, { upsert: true, returnDocument: 'after', lean: true })
    let doc
    try {
      doc = await load()
    } catch (error) {
      // Two first requests raced to create the document; the other one won, so read it
      if (error.code !== 11000) throw error
      doc = await load()
    }
    doc = await addMissingDefaults(doc)
    cached = { doc, loadedAt: Date.now() }
  }
  return cached.doc
}

export const invalidateSettings = () => {
  cached = null
}

/** What every visitor needs on every page; page bodies are fetched separately */
export const toPublicSettings = (s) => ({
  contact: s.contact,
  social: s.social,
  announcement: s.announcement.enabled && s.announcement.text ? { text: s.announcement.text, tone: s.announcement.tone, link: s.announcement.link || null } : null,
  listings: { maxPhotos: s.listings.maxPhotos, expiryDays: s.listings.expiryDays ?? 30 },
  // Sellers only see paid promotion when it is switched on and Stripe is configured
  promotions: {
    enabled: Boolean(s.promotions?.enabled && s.promotions.packages?.length && paymentsAvailable()),
    currency: 'SAR',
    packages: s.promotions?.packages ?? [],
  },
})
