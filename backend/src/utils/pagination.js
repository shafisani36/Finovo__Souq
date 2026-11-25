/** Reads ?page and ?pageSize safely; pageSize is capped so nobody can ask for the whole collection */
export const getPagination = (query, defaultSize = 12, maxSize = 48) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1)
  const pageSize = Math.min(maxSize, Math.max(1, Number.parseInt(query.pageSize, 10) || defaultSize))
  return { page, pageSize, skip: (page - 1) * pageSize }
}

export const paginated = (items, total, { page, pageSize }) => ({
  items,
  page,
  pageSize,
  total,
  totalPages: Math.max(1, Math.ceil(total / pageSize)),
})

export const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const toText = (value) => (typeof value === 'string' ? value.trim() : '')
