import { Router } from 'express'
import mongoose, { isValidObjectId } from 'mongoose'
import asyncHandler from '../../utils/asyncHandler.js'
import ApiResponse from '../../utils/ApiResponse.js'
import ApiError from '../../utils/ApiError.js'
import Listing, { PUBLIC_FILTER } from '../listings/listing.model.js'
import Category from './category.model.js'
import { branchHeight, getCategoryTree, invalidateCategoryTree, MAX_DEPTH, planBranchMove } from './category.tree.js'
import { slugify, validateCategory } from './category.validation.js'

const COUNTS_TTL_MS = 30_000
let countsCache = null

/** Live ads per category, where a parent counts every ad in its branch */
const liveCountsByCategory = async () => {
  if (!countsCache || Date.now() - countsCache.at > COUNTS_TTL_MS) {
    const rows = await Listing.aggregate([
      { $match: PUBLIC_FILTER },
      { $unwind: '$categoryPath' },
      { $group: { _id: '$categoryPath', count: { $sum: 1 } } },
    ])
    countsCache = { at: Date.now(), map: new Map(rows.map((r) => [r._id, r.count])) }
  }
  return countsCache.map
}

const publicView = (node, counts) => ({
  id: node.id,
  name: node.name,
  slug: node.slug,
  parentId: node.parentId,
  depth: node.depth,
  path: node.path,
  icon: node.icon,
  description: node.description,
  isLeaf: node.isLeaf,
  listingTypes: node.listingTypes,
  fields: node.fields,
  listingCount: counts.get(node.id) ?? 0,
})

/* ---------- Public ---------- */
const router = Router()

// The whole visible tree in depth-first order; the client builds menus and pickers from parentId
router.get('/', asyncHandler(async (req, res) => {
  const [tree, counts] = await Promise.all([getCategoryTree(), liveCountsByCategory()])
  res.json(new ApiResponse(200, tree.ordered.filter((n) => n.isActive).map((n) => publicView(n, counts))))
}))

export default router

/* ---------- Admin (mounted inside the admin router, so already admin-only) ---------- */
export const adminCategoryRouter = Router()

const loadNode = async (id) => {
  const tree = await getCategoryTree()
  const node = isValidObjectId(id) && tree.nodes.get(id)
  if (!node) throw ApiError.notFound('Category not found')
  return { tree, node }
}

const uniqueSlug = async (wanted, parentSlug, excludeId) => {
  const taken = async (slug) => Boolean(await Category.exists({ slug, ...(excludeId && { _id: { $ne: excludeId } }) }))
  const base = wanted || 'category'
  if (!(await taken(base))) return base
  const withParent = parentSlug ? `${parentSlug}-${base}`.slice(0, 60) : base
  if (!(await taken(withParent))) return withParent
  for (let n = 2; ; n += 1) if (!(await taken(`${withParent}-${n}`))) return `${withParent}-${n}`
}

/** A category that holds ads itself cannot get subcategories, or those ads would sit on a non-final level */
const assertCanHaveChildren = async (parent) => {
  if (!parent) return
  if (parent.depth >= MAX_DEPTH - 1) throw new ApiError(409, `Categories can be at most ${MAX_DEPTH} levels deep`)
  if (await Listing.exists({ categoryId: parent.id })) {
    throw new ApiError(409, `"${parent.name}" already has ads of its own, so it cannot get subcategories. Create the subcategory somewhere else, or ask sellers to move their ads first.`)
  }
}

const nextSortOrder = async (parentId) => {
  const last = await Category.findOne({ parent: parentId }).sort({ sortOrder: -1 }).select('sortOrder').lean()
  return last ? last.sortOrder + 1 : 0
}

adminCategoryRouter.get('/', asyncHandler(async (req, res) => {
  const tree = await getCategoryTree()
  const [direct, total] = await Promise.all([
    Listing.aggregate([{ $group: { _id: '$categoryId', count: { $sum: 1 } } }]),
    Listing.aggregate([{ $match: PUBLIC_FILTER }, { $unwind: '$categoryPath' }, { $group: { _id: '$categoryPath', count: { $sum: 1 } } }]),
  ])
  const directById = new Map(direct.map((r) => [r._id, r.count]))
  const liveById = new Map(total.map((r) => [r._id, r.count]))

  res.json(new ApiResponse(200, tree.ordered.map((n) => ({
    id: n.id,
    name: n.name,
    slug: n.slug,
    parentId: n.parentId,
    depth: n.depth,
    path: n.path,
    description: n.description,
    icon: n.ownIcon,
    effectiveIcon: n.icon,
    listingTypes: n.ownListingTypes,
    effectiveListingTypes: n.listingTypes,
    fields: n.ownFields,
    inheritedFields: n.parentId ? tree.nodes.get(n.parentId).fields : [],
    isActive: n.ownActive,
    isVisible: n.isActive,
    isLeaf: n.isLeaf,
    childCount: n.children.length,
    directListings: directById.get(n.id) ?? 0,
    liveListings: liveById.get(n.id) ?? 0,
  }))))
}))

adminCategoryRouter.post('/', asyncHandler(async (req, res) => {
  const data = validateCategory(req.body)
  const tree = await getCategoryTree()
  const parent = data.parent ? tree.nodes.get(data.parent) : null
  if (data.parent && !parent) throw ApiError.validation({ parentId: 'Choose a valid parent category' })
  await assertCanHaveChildren(parent)

  const category = await Category.create({
    ...data,
    slug: await uniqueSlug(data.slug ?? slugify(data.name), parent?.slug),
    ancestors: parent ? parent.path : [],
    sortOrder: await nextSortOrder(data.parent),
  })
  invalidateCategoryTree()
  res.status(201).json(new ApiResponse(201, { id: category.id }, 'Category created'))
}))

adminCategoryRouter.patch('/:id', asyncHandler(async (req, res) => {
  const { tree, node } = await loadNode(req.params.id)
  const { parent: parentId, ...data } = validateCategory(req.body, { partial: true })
  if (data.slug && data.slug !== node.slug) data.slug = await uniqueSlug(data.slug, null, node.id)

  const moving = parentId !== undefined && parentId !== node.parentId
  if (!moving) {
    await Category.updateOne({ _id: node.id }, { $set: data })
    invalidateCategoryTree()
    return res.json(new ApiResponse(200, { id: node.id }, 'Category updated'))
  }

  const newParent = parentId ? tree.nodes.get(parentId) : null
  if (parentId && !newParent) throw ApiError.validation({ parentId: 'Choose a valid parent category' })
  // newParent.path contains node.id when the new parent is the node itself or one of its subcategories
  if (newParent?.path.includes(node.id)) throw ApiError.validation({ parentId: 'A category cannot be moved inside itself' })
  if ((newParent ? newParent.depth + 1 : 0) + branchHeight(node) > MAX_DEPTH - 1) {
    throw new ApiError(409, `This move would make the tree deeper than ${MAX_DEPTH} levels`)
  }
  await assertCanHaveChildren(newParent)

  // Rewrite the path of every category in the moved branch, then the path stored on its ads
  const plan = planBranchMove(tree, node, newParent)
  const sortOrder = await nextSortOrder(parentId)
  await Category.bulkWrite(plan.map(({ id, ancestors }) => ({
    updateOne: { filter: { _id: id }, update: { $set: { ancestors: ancestors.map((a) => new mongoose.Types.ObjectId(a)) } } },
  })))
  await Category.updateOne({ _id: node.id }, { $set: { ...data, parent: parentId, sortOrder } })
  await Listing.bulkWrite(plan.map(({ id, path }) => ({ updateMany: { filter: { categoryId: id }, update: { $set: { categoryPath: path } } } })))

  invalidateCategoryTree()
  res.json(new ApiResponse(200, { id: node.id }, 'Category moved'))
}))

// Saves the order of one level after the admin moves a category up or down
adminCategoryRouter.post('/reorder', asyncHandler(async (req, res) => {
  const tree = await getCategoryTree()
  const parentId = req.body.parentId || null
  const siblings = parentId ? tree.nodes.get(parentId)?.children : tree.roots
  const ids = Array.isArray(req.body.ids) ? req.body.ids.map(String) : []
  if (!siblings || ids.length !== siblings.length || !siblings.every((s) => ids.includes(s.id))) {
    throw ApiError.validation({ ids: 'Send every category of this level exactly once' })
  }
  await Category.bulkWrite(ids.map((id, sortOrder) => ({ updateOne: { filter: { _id: id }, update: { $set: { sortOrder } } } })))
  invalidateCategoryTree()
  res.json(new ApiResponse(200, null, 'Order saved'))
}))

adminCategoryRouter.delete('/:id', asyncHandler(async (req, res) => {
  const { node } = await loadNode(req.params.id)
  if (!node.isLeaf) throw new ApiError(409, 'Delete or move its subcategories first')
  if (await Listing.exists({ categoryPath: node.id })) throw new ApiError(409, 'This category has ads. Hide it instead, so the ads stay safe.')
  await Category.deleteOne({ _id: node.id })
  invalidateCategoryTree()
  res.json(new ApiResponse(200, null, 'Category deleted'))
}))
