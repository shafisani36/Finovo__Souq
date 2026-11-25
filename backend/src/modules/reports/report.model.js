import mongoose from 'mongoose'

export const REPORT_REASONS = ['Prohibited item', 'Scam or fraud', 'Wrong category', 'Duplicate ad', 'Misleading price or details', 'Offensive content', 'Other']
export const REPORT_STATUSES = ['open', 'reviewing', 'resolved', 'dismissed']

const reportSchema = new mongoose.Schema(
  {
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    details: { type: String, trim: true, maxlength: 1000, default: null },
    status: { type: String, enum: REPORT_STATUSES, default: 'open' },
  },
  { timestamps: true }
)

reportSchema.index({ status: 1, createdAt: -1 })
// One report per person per ad
reportSchema.index({ listing: 1, reporter: 1 }, { unique: true })

const Report = mongoose.model('Report', reportSchema)

export const toReportView = (r) => ({
  id: r._id.toString(),
  listingId: r.listing?._id?.toString() ?? r.listing?.toString(),
  listingTitle: r.listing?.title ?? 'Deleted ad',
  reporter: { id: r.reporter?._id?.toString() ?? '', name: r.reporter?.name ?? 'Unknown user' },
  reason: r.reason,
  details: r.details,
  status: r.status,
  createdAt: r.createdAt,
})

export default Report
