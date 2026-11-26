import mongoose from 'mongoose'

export const MODERATION_ACTIONS = [
  'listing_approved',
  'listing_changes_requested',
  'listing_rejected',
  'listing_hidden',
  'seller_approved',
  'user_suspended',
  'user_reactivated',
  'listing_featured',
  'listing_unfeatured',
]

/** Audit trail of every admin decision: who did what, to which ad or account, and why */
const moderationLogSchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, enum: MODERATION_ACTIONS, required: true },
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', default: null },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reason: { type: String, default: null, maxlength: 500 },
    previousStatus: { type: String, required: true },
    newStatus: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

moderationLogSchema.index({ createdAt: -1 })
moderationLogSchema.index({ listing: 1, createdAt: -1 })
moderationLogSchema.index({ user: 1, createdAt: -1 })

moderationLogSchema.set('toJSON', {
  transform: (_doc, ret) => ({
    id: ret._id.toString(),
    action: ret.action,
    admin: ret.admin?.name ? { id: ret.admin._id.toString(), name: ret.admin.name } : null,
    listing: ret.listing?.title ? { id: ret.listing._id.toString(), title: ret.listing.title } : null,
    user: ret.user?.name ? { id: ret.user._id.toString(), name: ret.user.name, email: ret.user.email } : null,
    reason: ret.reason,
    previousStatus: ret.previousStatus,
    newStatus: ret.newStatus,
    createdAt: ret.createdAt,
  }),
})

const ModerationLog = mongoose.model('ModerationLog', moderationLogSchema)

export default ModerationLog
