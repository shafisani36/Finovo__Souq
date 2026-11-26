import { test } from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { branchHeight, branchIds, buildTree, categorySummary, mergeFields, photosRequired, planBranchMove } from '../src/modules/categories/category.tree.js'
import { DEFAULT_CATEGORIES } from '../src/modules/categories/defaultCategories.js'

// Same shape the seed writes to MongoDB
const flatten = (items, parent = null, ancestors = [], out = []) => {
  items.forEach(({ children = [], ...item }, index) => {
    const _id = new mongoose.Types.ObjectId()
    out.push({ ...item, _id, parent, ancestors, sortOrder: index })
    flatten(children, _id, [...ancestors, _id], out)
  })
  return out
}

const tree = buildTree(flatten(DEFAULT_CATEGORIES))
const bySlug = (slug) => tree.bySlug.get(slug)

test('default slugs are unique', () => {
  assert.equal(tree.bySlug.size, tree.nodes.size)
})

test('builds the hierarchy with paths and depth', () => {
  const laptops = bySlug('laptops')
  assert.deepEqual(laptops.path, [bySlug('electronics').id, bySlug('computers').id, laptops.id])
  assert.equal(laptops.depth, 2)
  assert.equal(bySlug('electronics').isLeaf, false)
  assert.equal(laptops.isLeaf, true)
  assert.deepEqual(tree.roots.map((r) => r.slug), ['vehicles', 'property', 'electronics', 'home-furniture', 'services'])
})

test('children inherit fields, listing types and icon, and can override them', () => {
  const apartments = bySlug('apartments')
  assert.deepEqual(apartments.fields.map((f) => f.fieldKey), ['area', 'bedrooms', 'bathrooms', 'furnished'])
  assert.deepEqual(apartments.listingTypes, ['sale', 'rent'])
  assert.equal(apartments.icon, 'property')
  assert.deepEqual(bySlug('land').listingTypes, ['sale'])
  assert.equal(bySlug('land').icon, 'land')
  assert.deepEqual(bySlug('laptops').fields.map((f) => f.fieldKey), ['condition', 'brand'])
  assert.equal(bySlug('laptops').icon, 'laptop')
})

test('mergeFields keeps parent order and lets a child replace a field', () => {
  const merged = mergeFields([{ fieldKey: 'a', label: 'A' }, { fieldKey: 'b', label: 'B' }], [{ fieldKey: 'b', label: 'B2' }, { fieldKey: 'c', label: 'C' }])
  assert.deepEqual(merged.map((f) => `${f.fieldKey}:${f.label}`), ['a:A', 'b:B2', 'c:C'])
})

test('depth-first order lists every parent before its children', () => {
  const position = new Map(tree.ordered.map((n, i) => [n.id, i]))
  for (const node of tree.ordered) if (node.parentId) assert.ok(position.get(node.parentId) < position.get(node.id))
})

test('hiding a parent hides its whole branch', () => {
  const docs = flatten(DEFAULT_CATEGORIES)
  docs.find((d) => d.slug === 'computers').isActive = false
  const hidden = buildTree(docs)
  assert.equal(hidden.bySlug.get('laptops').isActive, false)
  assert.equal(hidden.bySlug.get('mobile-phones').isActive, true)
})

test('branch helpers', () => {
  assert.deepEqual(new Set(branchIds(bySlug('computers'))), new Set(['computers', 'laptops', 'desktops', 'computer-accessories'].map((s) => bySlug(s).id)))
  assert.equal(branchHeight(bySlug('electronics')), 2)
  assert.equal(branchHeight(bySlug('cars')), 0)
})

test('photos are optional only for service categories', () => {
  assert.equal(photosRequired(bySlug('cleaning')), false)
  assert.equal(photosRequired(bySlug('cars')), true)
})

test('category summary gives a breadcrumb trail', () => {
  const summary = categorySummary(tree, bySlug('desktops').id)
  assert.equal(summary.categoryName, 'Desktops')
  assert.deepEqual(summary.categoryTrail.map((c) => c.slug), ['electronics', 'computers', 'desktops'])
  assert.equal(categorySummary(tree, 'missing').categoryName, 'Uncategorized')
})

test('an orphan whose parent was deleted becomes a root instead of crashing', () => {
  const docs = flatten(DEFAULT_CATEGORIES).filter((d) => d.slug !== 'computers')
  const t = buildTree(docs)
  assert.equal(t.bySlug.get('laptops').depth, 0)
})

test('moving a branch rewrites the path of every category in it', () => {
  const plan = planBranchMove(tree, bySlug('computers'), bySlug('vehicles'))
  const laptops = plan.find((p) => p.id === bySlug('laptops').id)
  assert.deepEqual(laptops.path, [bySlug('vehicles').id, bySlug('computers').id, bySlug('laptops').id])
  assert.deepEqual(laptops.ancestors, [bySlug('vehicles').id, bySlug('computers').id])
  assert.equal(plan.length, 4)

  const toTop = planBranchMove(tree, bySlug('computers'), null)
  assert.deepEqual(toTop.find((p) => p.id === bySlug('desktops').id).path, [bySlug('computers').id, bySlug('desktops').id])
})
