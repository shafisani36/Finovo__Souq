import { getCategoryTree } from '../categories/category.tree.js'
import { publicUrl, signedUrl } from '../../services/storage.service.js'
import { notify } from '../../services/notification.service.js'
import { emitToUser } from '../../realtime/socket.js'
import ApiError from '../../utils/ApiError.js'
import User from '../users/user.model.js'
import Listing from '../listings/listing.model.js'
import Conversation from './conversation.model.js'
import Message from './message.model.js'

const PREVIEWS = { image: 'Photo', voice: 'Voice message' }

export const toMessageView = (m) => ({
  id: m._id.toString(),
  conversationId: m.conversation.toString(),
  senderId: m.sender.toString(),
  type: m.type,
  body: m.deletedAt ? '' : m.body,
  attachment: m.attachment && !m.deletedAt
    ? { url: signedUrl(m.attachment.key), mime: m.attachment.mime, size: m.attachment.size, width: m.attachment.width ?? null, height: m.attachment.height ?? null, duration: m.attachment.duration ?? null }
    : null,
  deleted: Boolean(m.deletedAt),
  createdAt: m.createdAt,
})

/** Builds the inbox rows for one viewer; the other person's email and phone are never included */
export const toConversationViews = async (conversations, viewerId) => {
  const otherIds = conversations.map((c) => (c.buyer.toString() === viewerId ? c.seller : c.buyer))
  const [tree, users, listings] = await Promise.all([
    getCategoryTree(),
    User.find({ _id: { $in: otherIds } }).select('name avatarKey').lean(),
    Listing.find({ _id: { $in: conversations.map((c) => c.listing) } }).select('title price photos categoryId status availability').lean(),
  ])
  const userById = new Map(users.map((u) => [u._id.toString(), u]))
  const listingById = new Map(listings.map((l) => [l._id.toString(), l]))

  return conversations.map((c, i) => {
    const role = c.roleOf(viewerId)
    const otherRole = role === 'buyer' ? 'seller' : 'buyer'
    const other = userById.get(otherIds[i].toString())
    const listing = listingById.get(c.listing.toString())
    return {
      id: c._id.toString(),
      role,
      listingId: c.listing.toString(),
      listingTitle: listing?.title ?? 'Deleted ad',
      listingPrice: listing?.price ?? 0,
      listingPhotoUrl: publicUrl(listing?.photos?.[0]?.key),
      listingCategoryIcon: tree.nodes.get(listing?.categoryId)?.icon ?? 'tag',
      listingAvailable: listing?.status === 'published' && listing?.availability === 'available',
      counterpart: { id: otherIds[i].toString(), name: other?.name ?? 'Former member', avatarUrl: publicUrl(other?.avatarKey) },
      lastMessage: c.lastMessage.preview,
      lastMessageAt: c.lastMessage.at,
      lastMessageMine: c.lastMessage.sender?.toString() === viewerId,
      unreadCount: c.unread[role],
      counterpartLastReadAt: c.lastReadAt[otherRole],
      blockedByMe: c.blockedBy.some((id) => id.toString() === viewerId),
      blockedByThem: c.blockedBy.some((id) => id.toString() !== viewerId),
    }
  })
}

/** Loads a conversation for a participant; anyone else gets "not found" so ids reveal nothing */
export const findParticipantConversation = async (conversationId, userId) => {
  const conversation = await Conversation.findOne({ _id: conversationId, $or: [{ buyer: userId }, { seller: userId }] })
  if (!conversation) throw ApiError.notFound('Conversation not found')
  return conversation
}

/** Tells both participants about a change, each with the inbox row as they see it */
const broadcast = async (conversation, event, payload) => {
  for (const userId of [conversation.buyer.toString(), conversation.seller.toString()]) {
    const [view] = await toConversationViews([conversation], userId)
    emitToUser(userId, event, { ...payload, conversation: view })
  }
}

/** Saves a message, updates both inboxes and notifies the recipient */
export const deliverMessage = async (conversation, senderId, data) => {
  if (conversation.blockedBy.length) throw new ApiError(403, 'You cannot send messages in this conversation')
  const role = conversation.roleOf(senderId)
  const otherRole = role === 'buyer' ? 'seller' : 'buyer'
  const recipientId = conversation[otherRole].toString()
  const hadUnread = conversation.unread[otherRole] > 0

  const message = await Message.create({ ...data, conversation: conversation._id, sender: senderId })
  conversation.lastMessage = { preview: PREVIEWS[message.type] ?? message.body.slice(0, 120), sender: senderId, at: message.createdAt }
  conversation.unread[otherRole] += 1
  conversation.unread[role] = 0
  conversation.lastReadAt[role] = message.createdAt
  if (role === 'seller' && !conversation.sellerRepliedAt) conversation.sellerRepliedAt = message.createdAt
  await conversation.save()

  const view = toMessageView(message)
  await broadcast(conversation, 'message:new', { message: view })

  // One notification per unread streak, not one per message
  if (!hadUnread) {
    const sender = await User.findById(senderId).select('name').lean()
    await notify(recipientId, {
      type: 'new_message',
      title: 'New message',
      body: `${sender?.name ?? 'Someone'} sent you a message.`,
      link: `/account/messages?c=${conversation.id}`,
    })
  }
  return view
}

export const markRead = async (conversation, userId) => {
  const role = conversation.roleOf(userId)
  conversation.unread[role] = 0
  conversation.lastReadAt[role] = new Date()
  await conversation.save()
  await broadcast(conversation, 'conversation:read', { conversationId: conversation.id, readerId: userId, readAt: conversation.lastReadAt[role] })
}

export const updateBlock = async (conversation, userId, blocked) => {
  conversation.blockedBy = conversation.blockedBy.filter((id) => id.toString() !== userId)
  if (blocked) conversation.blockedBy.push(userId)
  await conversation.save()
  await broadcast(conversation, 'conversation:updated', {})
}

export const announceDeleted = (conversation, message) => broadcast(conversation, 'message:deleted', { message: toMessageView(message) })
