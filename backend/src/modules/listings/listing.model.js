import mongoose from 'mongoose'

const photoSchema = new mongoose.Schema({
  key: { type: String, required: true },
  width: Number,
  height: Number,
})

const listingSchema = new mongoose.Schema(
  {
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    categoryId: { type: String, required: true },
    listingType: { type: String, enum: ['sale', 'rent', 'service'], required: true },
    title: { type: String, required: true, trim: true, maxlength: 90 },
    description: { type: String, required: true, trim: true, maxlength: 4000 },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'SAR' },
    city: { type: String, required: true },
    district: { type: String, required: true, trim: true },
    attributes: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ['draft', 'pending_review', 'published', 'changes_required', 'rejected', 'hidden', 'withdrawn'],
      default: 'draft',
    },
    availability: { type: String, enum: ['available', 'sold', 'rented'], default: 'available' },
    // Array order is the display order; the first photo is the cover
    photos: { type: [photoSchema], default: [] },
    views: { type: Number, default: 0 },
    moderationNote: { type: String, default: null },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true, minimize: false }
)

// Public search: live ads, newest first, narrowed by category, city or price
listingSchema.index({ status: 1, availability: 1, publishedAt: -1 })
listingSchema.index({ status: 1, categoryId: 1, publishedAt: -1 })
listingSchema.index({ status: 1, city: 1, price: 1 })
listingSchema.index({ seller: 1, updatedAt: -1 })

export const PUBLIC_FILTER = { status: 'published', availability: 'available' }
export const LOCKED_STATUSES = ['withdrawn', 'hidden', 'rejected']

const Listing = mongoose.model('Listing', listingSchema)

export default Listing
