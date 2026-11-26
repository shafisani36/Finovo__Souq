/**
 * Decides whether a saved search would find a listing, using the same rules as the public search:
 * category covers its whole branch, text matches title or description, detail filters compare attributes.
 * Pure function so it can be unit tested without a database.
 */
export const matchesCriteria = (criteria, listing, categoryBySlug) => {
  if (criteria.category) {
    const category = categoryBySlug(criteria.category)
    if (!category || !listing.categoryPath.includes(category.id)) return false
  }
  if (criteria.city && criteria.city !== listing.city) return false

  const minPrice = Number(criteria.minPrice)
  const maxPrice = Number(criteria.maxPrice)
  if (criteria.minPrice && Number.isFinite(minPrice) && listing.price < minPrice) return false
  if (criteria.maxPrice && Number.isFinite(maxPrice) && listing.price > maxPrice) return false

  if (criteria.q) {
    const q = String(criteria.q).toLowerCase()
    if (!`${listing.title}\n${listing.description}`.toLowerCase().includes(q)) return false
  }

  for (const [key, raw] of Object.entries(criteria)) {
    if (!key.startsWith('f_') || raw === '' || raw === undefined) continue
    const bound = key.endsWith('_min') ? 'min' : key.endsWith('_max') ? 'max' : null
    const field = bound ? key.slice(2, -4) : key.slice(2)
    const value = listing.attributes?.[field]
    if (bound) {
      const limit = Number(raw)
      if (!Number.isFinite(limit)) continue
      if (typeof value !== 'number') return false
      if (bound === 'min' ? value < limit : value > limit) return false
    } else if (String(value) !== String(raw)) return false
  }
  return true
}
