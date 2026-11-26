import mongoose from 'mongoose'
import { logger } from '../../utils/logger.js'
import Listing from '../listings/listing.model.js'
import Category from './category.model.js'
import { DEFAULT_CATEGORIES, LEGACY_CATEGORY_MAP } from './defaultCategories.js'
import { invalidateCategoryTree } from './category.tree.js'

const flatten = (items, parent = null, ancestors = [], out = []) => {
  items.forEach(({ children = [], ...item }, index) => {
    const _id = new mongoose.Types.ObjectId()
    out.push({ ...item, _id, parent, ancestors, sortOrder: index })
    flatten(children, _id, [...ancestors, _id], out)
  })
  return out
}

/** Moves ads saved with the old fixed category ids into the matching new subcategory */
const migrateLegacyListings = async (docs) => {
  const bySlug = new Map(docs.map((d) => [d.slug, d]))
  const pathOf = (doc) => [...doc.ancestors, doc._id].map(String)

  const legacy = await Listing.find({ categoryId: { $in: Object.keys(LEGACY_CATEGORY_MAP) } }).select('categoryId attributes').lean()
  if (!legacy.length) return 0

  await Listing.bulkWrite(legacy.map((listing) => {
    const rule = LEGACY_CATEGORY_MAP[listing.categoryId]
    const slug = rule.map?.[listing.attributes?.[rule.attribute]] ?? rule.default
    const target = bySlug.get(slug)
    return { updateOne: { filter: { _id: listing._id }, update: { $set: { categoryId: target._id.toString(), categoryPath: pathOf(target) } } } }
  }))
  return legacy.length
}

/** Runs at start-up: creates the starting tree on a new database, otherwise does nothing */
export const ensureDefaultCategories = async () => {
  if (await Category.estimatedDocumentCount()) return

  const docs = flatten(DEFAULT_CATEGORIES)
  try {
    await Category.insertMany(docs)
  } catch (error) {
    // Another server instance created them at the same moment
    if (error.code === 11000) return
    throw error
  }
  const moved = await migrateLegacyListings(docs)
  invalidateCategoryTree()
  logger.info('default categories created', { categories: docs.length, adsMoved: moved })
}
