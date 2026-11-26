import Category from './category.model.js'

export const MAX_DEPTH = 4
const CACHE_TTL_MS = 60_000

/** Parent fields first, in their order; a child field with the same key replaces the parent's */
export const mergeFields = (inherited, own) => {
  const merged = new Map(inherited.map((f) => [f.fieldKey, f]))
  for (const field of own) merged.set(field.fieldKey, field)
  return [...merged.values()]
}

/**
 * Turns the flat category documents into a resolved tree in one pass:
 * every node gets its children, its full path, depth-first order and the values it inherits.
 * Pure function, so it is easy to test and cheap to rebuild after an admin change.
 */
export const buildTree = (docs) => {
  const nodes = new Map()
  for (const d of docs) {
    nodes.set(d._id.toString(), {
      id: d._id.toString(),
      name: d.name,
      slug: d.slug,
      parentId: d.parent ? d.parent.toString() : null,
      description: d.description ?? '',
      sortOrder: d.sortOrder ?? 0,
      ownIcon: d.icon ?? null,
      ownListingTypes: d.listingTypes ?? [],
      ownFields: d.fields ?? [],
      ownActive: d.isActive !== false,
      children: [],
    })
  }

  const roots = []
  for (const node of nodes.values()) {
    const parent = node.parentId && nodes.get(node.parentId)
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  const bySortOrder = (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
  const ordered = []
  const visit = (node, parent) => {
    node.path = parent ? [...parent.path, node.id] : [node.id]
    node.depth = node.path.length - 1
    node.icon = node.ownIcon ?? parent?.icon ?? 'tag'
    node.listingTypes = node.ownListingTypes.length ? node.ownListingTypes : parent?.listingTypes ?? ['sale']
    node.fields = mergeFields(parent?.fields ?? [], node.ownFields)
    // A hidden category hides its whole branch
    node.isActive = node.ownActive && (parent ? parent.isActive : true)
    node.isLeaf = node.children.length === 0
    node.children.sort(bySortOrder)
    ordered.push(node)
    node.children.forEach((child) => visit(child, node))
  }
  roots.sort(bySortOrder).forEach((root) => visit(root, null))

  return { nodes, roots, ordered, bySlug: new Map(ordered.map((n) => [n.slug, n])) }
}

/** Every category id in the branch that starts at `node`, the node included */
export const branchIds = (node) => {
  const ids = []
  const walk = (n) => {
    ids.push(n.id)
    n.children.forEach(walk)
  }
  walk(node)
  return ids
}

/** Levels below the node: a leaf is 0, a node with only leaf children is 1 */
export const branchHeight = (node) => (node.isLeaf ? 0 : 1 + Math.max(...node.children.map(branchHeight)))

/**
 * New paths for every category in a branch that moves under `newParent` (null = top level).
 * Each node keeps the part of its path from the moved node down and gets the new parent's path in front.
 */
export const planBranchMove = (tree, node, newParent) => branchIds(node).map((id) => {
  const path = [...(newParent?.path ?? []), ...tree.nodes.get(id).path.slice(node.depth)]
  return { id, ancestors: path.slice(0, -1), path }
})

let cached = null

/** The whole tree from memory. Rebuilt after an admin change, and every minute in case another server changed it */
export const getCategoryTree = async () => {
  if (!cached || Date.now() - cached.loadedAt > CACHE_TTL_MS) {
    const docs = await Category.find().lean()
    cached = { tree: buildTree(docs), loadedAt: Date.now() }
  }
  return cached.tree
}

export const invalidateCategoryTree = () => {
  cached = null
}

export const findCategory = async (idOrSlug) => {
  if (!idOrSlug) return null
  const tree = await getCategoryTree()
  return tree.nodes.get(idOrSlug) ?? tree.bySlug.get(idOrSlug) ?? null
}

/** Ad photos are optional only where every ad is a service */
export const photosRequired = (node) => !(node.listingTypes.length === 1 && node.listingTypes[0] === 'service')

/** What a listing shows about its category: the leaf name plus the trail for breadcrumbs */
export const categorySummary = (tree, categoryId) => {
  const node = tree.nodes.get(categoryId)
  if (!node) return { categorySlug: '', categoryName: 'Uncategorized', categoryIcon: 'tag', categoryTrail: [] }
  return {
    categorySlug: node.slug,
    categoryName: node.name,
    categoryIcon: node.icon,
    categoryTrail: node.path.map((id) => {
      const n = tree.nodes.get(id)
      return { id: n.id, name: n.name, slug: n.slug }
    }),
  }
}
