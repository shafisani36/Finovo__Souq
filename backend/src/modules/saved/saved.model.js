import mongoose from 'mongoose'

const savedListingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
  },
  { timestamps: true }
)
savedListingSchema.index({ user: 1, listing: 1 }, { unique: true })
savedListingSchema.index({ user: 1, createdAt: -1 })

const savedSearchSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    label: { type: String, required: true, trim: true, maxlength: 80 },
    criteria: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Notify the user when a newly approved ad matches this search
    alertsEnabled: { type: Boolean, default: true },
    lastAlertAt: { type: Date, default: null },
  },
  { timestamps: true, minimize: false }
)
savedSearchSchema.index({ alertsEnabled: 1 })
savedSearchSchema.set('toJSON', {
  transform: (doc, ret) => ({ id: ret._id.toString(), label: ret.label, criteria: ret.criteria, alertsEnabled: ret.alertsEnabled !== false, createdAt: ret.createdAt }),
})

export const SavedListing = mongoose.model('SavedListing', savedListingSchema)
export const SavedSearch = mongoose.model('SavedSearch', savedSearchSchema)
