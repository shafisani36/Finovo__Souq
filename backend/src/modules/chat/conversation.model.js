import mongoose from 'mongoose'

const perParticipant = (type, fallback) => ({
  buyer: { type, default: fallback },
  seller: { type, default: fallback },
})

const conversationSchema = new mongoose.Schema(
  {
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lastMessage: {
      preview: { type: String, default: '' },
      sender: { type: mongoose.Schema.Types.ObjectId, default: null },
      at: { type: Date, default: Date.now },
    },
    unread: perParticipant(Number, 0),
    lastReadAt: perParticipant(Date, null),
    // A participant who blocks the other stops all new messages in this conversation
    blockedBy: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    sellerRepliedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

// One conversation per buyer per ad
conversationSchema.index({ listing: 1, buyer: 1 }, { unique: true })
conversationSchema.index({ buyer: 1, 'lastMessage.at': -1 })
conversationSchema.index({ seller: 1, 'lastMessage.at': -1 })

/** "buyer" or "seller" for a participant, or null for anyone else */
conversationSchema.methods.roleOf = function (userId) {
  if (this.buyer.toString() === userId) return 'buyer'
  if (this.seller.toString() === userId) return 'seller'
  return null
}

const Conversation = mongoose.model('Conversation', conversationSchema)

export default Conversation
