import mongoose from 'mongoose'

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['listing_approved', 'changes_required', 'listing_rejected', 'new_message', 'report_update', 'system'],
      required: true,
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    link: { type: String, default: null },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
)

notificationSchema.index({ user: 1, createdAt: -1 })
// Old notifications are removed after 90 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 })

notificationSchema.set('toJSON', {
  transform: (doc, ret) => ({
    id: ret._id.toString(),
    type: ret.type,
    title: ret.title,
    body: ret.body,
    link: ret.link,
    read: ret.read,
    createdAt: ret.createdAt,
  }),
})

const Notification = mongoose.model('Notification', notificationSchema)

export default Notification
