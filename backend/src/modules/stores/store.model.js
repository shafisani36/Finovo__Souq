import mongoose from 'mongoose'

export const STORE_STATUSES = ['pending', 'verified', 'rejected', 'suspended']

/**
 * A business page for a shop, showroom or agency. It goes public only after the team checks
 * the commercial registration (CR) number, and then shows a "Verified business" badge.
 */
const storeSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    slug: { type: String, required: true, unique: true },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    city: { type: String, default: null },
    // Saudi CR numbers have 10 digits; kept private, shown only to the owner and admins
    commercialRegistration: { type: String, required: true, match: /^\d{10}$/ },
    logoKey: { type: String, default: null },
    status: { type: String, enum: STORE_STATUSES, default: 'pending' },
    reviewNote: { type: String, default: null, maxlength: 300 },
    verifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

storeSchema.index({ status: 1, createdAt: -1 })

const Store = mongoose.model('Store', storeSchema)

export default Store
