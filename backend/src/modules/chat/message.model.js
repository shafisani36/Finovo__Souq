import mongoose from 'mongoose'

const messageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['text', 'image', 'voice'], default: 'text' },
    body: { type: String, trim: true, maxlength: 2000, default: '' },
    // Chat files are private: they are only reachable through short-lived signed links
    attachment: {
      type: new mongoose.Schema({ key: String, mime: String, size: Number, width: Number, height: Number, duration: Number }, { _id: false }),
      default: null,
    },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

messageSchema.index({ conversation: 1, _id: -1 })

const Message = mongoose.model('Message', messageSchema)

export default Message
