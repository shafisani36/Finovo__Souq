import { randomBytes } from 'node:crypto'
import bcrypt from 'bcrypt'
import { disconnectUser } from '../../realtime/socket.js'
import { sendMail } from '../../services/mail.service.js'
import { removeFile } from '../../services/storage.service.js'
import { revokeAllUserSessions } from '../../services/session.service.js'
import { logger } from '../../utils/logger.js'
import Conversation from '../chat/conversation.model.js'
import Message from '../chat/message.model.js'
import Listing from '../listings/listing.model.js'
import Notification from '../notifications/notification.model.js'
import { SavedListing, SavedSearch } from '../saved/saved.model.js'
import Store from '../stores/store.model.js'
import User from './user.model.js'

/**
 * Deletes an account the way the privacy policy promises: personal details are erased, ads are taken
 * offline with their photos, the person's chat messages and files are removed, and every session ends.
 * The account record stays as "Deleted user" so the other side of a conversation and the audit log still make sense.
 */
export const deleteAccount = async (user) => {
  const { email, name } = user
  const userId = user._id

  await revokeAllUserSessions(userId)
  disconnectUser(userId)

  const [listings, store] = await Promise.all([Listing.find({ seller: userId }).select('photos').lean(), Store.findOneAndDelete({ owner: userId }).lean()])
  const messages = await Message.find({ sender: userId, 'attachment.key': { $ne: null } }).select('attachment.key').lean()
  await Promise.all([
    Listing.updateMany({ seller: userId }, { $set: { status: 'withdrawn', photos: [], featuredUntil: null } }),
    Message.updateMany({ sender: userId }, { $set: { body: '', attachment: null, deletedAt: new Date() } }),
    Conversation.updateMany({ 'lastMessage.sender': userId }, { $set: { 'lastMessage.preview': 'Message deleted' } }),
    SavedListing.deleteMany({ user: userId }),
    SavedSearch.deleteMany({ user: userId }),
    Notification.deleteMany({ user: userId }),
  ])

  const files = [...listings.flatMap((l) => l.photos.map((p) => p.key)), ...messages.map((m) => m.attachment.key), user.avatarKey, store?.logoKey].filter(Boolean)
  await Promise.all(files.map((key) => removeFile(key).catch(() => {})))

  await User.updateOne({ _id: userId }, {
    $set: {
      name: 'Deleted user',
      email: `deleted-${userId}@deleted.invalid`,
      // A random password nobody knows, so the record can never be signed into
      password: await bcrypt.hash(randomBytes(32).toString('hex'), 12),
      phone: null,
      city: null,
      avatarKey: null,
      status: 'deleted',
      deletedAt: new Date(),
      deletionRequestedAt: null,
      deletionReason: null,
    },
  })

  // Confirmation to the old address; deletion still counts if the email cannot be sent
  await sendMail({
    to: email,
    subject: 'Your Finovo Souq account has been deleted',
    text: `Hi ${name},\n\nAs you asked, your Finovo Souq account and ads have been deleted. If you did not ask for this, reply to this email.\n\nFinovo Souq`,
  }).catch(() => logger.warn('account deletion email not sent'))
}
