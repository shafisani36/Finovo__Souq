import mongoose from 'mongoose'

const photoSchema = new mongoose.Schema({
  key: { type: String, required: true },
  width: Number,
  height: Number,
})

const listingSchema = new mongoose.Schema(
  {
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // The final (leaf) category, plus every category above it so a search on a parent finds the whole branch
    categoryId: { type: String, required: true },
    categoryPath: { type: [String], default: [] },
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
      enum: ['draft', 'pending_review', 'published', 'changes_required', 'rejected', 'hidden', 'withdrawn', 'expired'],
      default: 'draft',
    },
    availability: { type: String, enum: ['available', 'sold', 'rented'], default: 'available' },
    // Array order is the display order; the first photo is the cover
    photos: { type: [photoSchema], default: [] },
    views: { type: Number, default: 0 },
    moderationNote: { type: String, default: null },
    publishedAt: { type: Date, default: null },
    // A live ad goes offline at this time unless the seller renews it
    expiresAt: { type: Date, default: null },
    expiryReminderSentAt: { type: Date, default: null },
    // Price when the ad was last approved, used to tell people who saved it about a price drop
    publishedPrice: { type: Number, default: null },
    // Admin promotion: the ad is shown first and marked "Featured" until this time
    featuredUntil: { type: Date, default: null },
  },
  { timestamps: true, minimize: false }
)

// Public search: live ads, newest first, narrowed by category, city or price
listingSchema.index({ status: 1, availability: 1, publishedAt: -1 })
listingSchema.index({ status: 1, categoryPath: 1, publishedAt: -1 })
listingSchema.index({ categoryId: 1 })
listingSchema.index({ status: 1, city: 1, price: 1 })
listingSchema.index({ seller: 1, updatedAt: -1 })
listingSchema.index({ status: 1, expiresAt: 1 })
listingSchema.index({ status: 1, featuredUntil: -1, publishedAt: -1 })

export const PUBLIC_FILTER = { status: 'published', availability: 'available' }
export const LOCKED_STATUSES = ['withdrawn', 'hidden', 'rejected']

const Listing = mongoose.model('Listing', listingSchema)

export default Listing
