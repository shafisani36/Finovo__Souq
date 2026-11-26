import Setting, { PAGE_SLUGS } from './setting.model.js'
import { DEFAULT_SETTINGS } from './settings.defaults.js'

const CACHE_TTL_MS = 60_000
let cached = null

// Settings added in a later release get their default value once, without touching what admins already changed
const addMissingDefaults = async (doc) => {
  const $set = {}
  for (const slug of PAGE_SLUGS) if (!doc.pages?.[slug]) $set[`pages.${slug}`] = { ...DEFAULT_SETTINGS.pages[slug], updatedAt: new Date() }
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS.listings)) if (doc.listings?.[key] === undefined) $set[`listings.${key}`] = value
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
})
