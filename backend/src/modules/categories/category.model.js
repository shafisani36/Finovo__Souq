import mongoose from 'mongoose'

export const FIELD_INPUT_TYPES = ['text', 'number', 'select']
export const LISTING_TYPES = ['sale', 'rent', 'service']
export const CATEGORY_ICONS = [
  'car', 'motorcycle', 'parts', 'property', 'land', 'store', 'electronics', 'phone', 'laptop', 'tv', 'camera',
  'gaming', 'furniture', 'sofa', 'bed', 'kitchen', 'decor', 'services', 'cleaning', 'truck', 'tools', 'education', 'tag',
]

/** One detail an ad in this category asks for, such as "Make" or "Bedrooms" */
const fieldSchema = new mongoose.Schema(
  {
    fieldKey: { type: String, required: true },
    label: { type: String, required: true },
    inputType: { type: String, enum: FIELD_INPUT_TYPES, required: true },
    required: { type: Boolean, default: false },
    filterable: { type: Boolean, default: false },
    options: { type: [String], default: undefined },
    unit: { type: String, default: undefined },
    min: { type: Number, default: undefined },
    max: { type: Number, default: undefined },
  },
  { _id: false }
)

/**
 * Category tree stored with a materialized path: `ancestors` holds every parent id from the root down,
 * so a whole branch is found with one indexed query and moving a branch rewrites only that branch.
 * Fields, listing types and the icon are inherited from the parents; a child adds to or overrides them.
 */
const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    ancestors: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    description: { type: String, default: '', trim: true, maxlength: 160 },
    icon: { type: String, enum: [...CATEGORY_ICONS, null], default: null },
    // Empty means "same as the parent"
    listingTypes: { type: [String], enum: LISTING_TYPES, default: [] },
    fields: { type: [fieldSchema], default: [] },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

categorySchema.index({ parent: 1, sortOrder: 1 })
categorySchema.index({ ancestors: 1 })

const Category = mongoose.model('Category', categorySchema)

export default Category
