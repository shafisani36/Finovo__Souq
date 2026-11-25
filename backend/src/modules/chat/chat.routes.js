import { Router } from 'express'
import authenticate from '../../middleware/authenticate.js'
import authorize from '../../middleware/authorize.js'
import { chatAttachmentUpload } from '../../middleware/upload.js'
import { messageLimiter, uploadLimiter, writeLimiter } from '../../middleware/rateLimiter.js'
import asyncHandler from '../../utils/asyncHandler.js'
import ApiResponse from '../../utils/ApiResponse.js'
import ApiError from '../../utils/ApiError.js'
import { toText } from '../../utils/pagination.js'
import { saveAudio, saveImage, removeFile } from '../../services/storage.service.js'
import Listing, { PUBLIC_FILTER } from '../listings/listing.model.js'
import Conversation from './conversation.model.js'
import Message from './message.model.js'
import {
  announceDeleted,
  deliverMessage,
  findParticipantConversation,
  markRead,
  toConversationViews,
  toMessageView,
  updateBlock,
} from './chat.service.js'

const PAGE_SIZE = 30
const MAX_VOICE_SECONDS = 120
const MAX_VOICE_BYTES = 3 * 1024 * 1024

const router = Router()
router.use(authenticate, authorize('user'))

router.get('/', asyncHandler(async (req, res) => {
  const conversations = await Conversation.find({ $or: [{ buyer: req.user.id }, { seller: req.user.id }] })
    .sort({ 'lastMessage.at': -1 })
    .limit(100)
  res.json(new ApiResponse(200, await toConversationViews(conversations, req.user.id)))
}))

// Starts a conversation about an ad, or returns the one that already exists
router.post('/', writeLimiter, asyncHandler(async (req, res) => {
  const listing = await Listing.findOne({ _id: toText(req.body.listingId), ...PUBLIC_FILTER }).select('seller')
  if (!listing) throw new ApiError(409, 'This ad is no longer available')
  if (listing.seller.toString() === req.user.id) throw new ApiError(409, 'You cannot message yourself about your own ad')

  const conversation = await Conversation.findOneAndUpdate(
    { listing: listing._id, buyer: req.user.id },
    { $setOnInsert: { seller: listing.seller } },
    { upsert: true, returnDocument: 'after' }
  )
  const [view] = await toConversationViews([conversation], req.user.id)
  res.json(new ApiResponse(200, view))
}))

// Newest page first; ?before=<messageId> loads older messages
router.get('/:id/messages', asyncHandler(async (req, res) => {
  const conversation = await findParticipantConversation(req.params.id, req.user.id)
  const filter = { conversation: conversation._id }
  if (req.query.before) filter._id = { $lt: toText(req.query.before) }

  const page = await Message.find(filter).sort({ _id: -1 }).limit(PAGE_SIZE + 1)
  const hasMore = page.length > PAGE_SIZE
  const items = page.slice(0, PAGE_SIZE).reverse().map(toMessageView)
  if (!req.query.before) await markRead(conversation, req.user.id)
  res.json(new ApiResponse(200, { items, hasMore }))
}))

router.post('/:id/messages', messageLimiter, asyncHandler(async (req, res) => {
  const conversation = await findParticipantConversation(req.params.id, req.user.id)
  const body = toText(req.body.body)
  if (!body) throw ApiError.validation({ body: 'Write a message' })
  if (body.length > 2000) throw ApiError.validation({ body: 'Messages can be up to 2000 characters' })
  const message = await deliverMessage(conversation, req.user.id, { type: 'text', body })
  res.status(201).json(new ApiResponse(201, message))
}))

// Photo or voice message, sent as multipart form data: file + kind (image|voice) + duration for voice
router.post('/:id/attachments', uploadLimiter, messageLimiter, chatAttachmentUpload, asyncHandler(async (req, res) => {
  const conversation = await findParticipantConversation(req.params.id, req.user.id)
  if (conversation.blockedBy.length) throw new ApiError(403, 'You cannot send messages in this conversation')
  if (!req.file) throw ApiError.validation({ file: 'Choose a file' })

  let attachment
  if (req.body.kind === 'voice') {
    const duration = Math.round(Number(req.body.duration))
    if (req.file.size > MAX_VOICE_BYTES) throw ApiError.validation({ file: 'Voice message is too large' })
    if (!(duration >= 1 && duration <= MAX_VOICE_SECONDS)) throw ApiError.validation({ file: `Voice messages can be up to ${MAX_VOICE_SECONDS / 60} minutes` })
    attachment = { ...(await saveAudio(req.file.buffer, 'private/chat')), duration }
  } else if (req.body.kind === 'image') {
    attachment = await saveImage(req.file.buffer, 'private/chat', 'chat')
  } else {
    throw ApiError.validation({ kind: 'Unsupported attachment' })
  }

  try {
    const message = await deliverMessage(conversation, req.user.id, { type: req.body.kind, attachment, body: toText(req.body.caption).slice(0, 500) })
    res.status(201).json(new ApiResponse(201, message))
  } catch (error) {
    await removeFile(attachment.key)
    throw error
  }
}))

router.post('/:id/read', asyncHandler(async (req, res) => {
  const conversation = await findParticipantConversation(req.params.id, req.user.id)
  await markRead(conversation, req.user.id)
  res.json(new ApiResponse(200, null))
}))

// Senders can delete their own messages; the file is removed from the server too
router.delete('/:id/messages/:messageId', asyncHandler(async (req, res) => {
  const conversation = await findParticipantConversation(req.params.id, req.user.id)
  const message = await Message.findOne({ _id: req.params.messageId, conversation: conversation._id, sender: req.user.id, deletedAt: null })
  if (!message) throw ApiError.notFound('Message not found')
  const fileKey = message.attachment?.key
  message.set({ deletedAt: new Date(), body: '', attachment: null })
  await message.save()
  await removeFile(fileKey)
  await announceDeleted(conversation, message)
  res.json(new ApiResponse(200, toMessageView(message)))
}))

router.post('/:id/block', asyncHandler(async (req, res) => {
  const conversation = await findParticipantConversation(req.params.id, req.user.id)
  await updateBlock(conversation, req.user.id, true)
  res.json(new ApiResponse(200, null, 'User blocked'))
}))

router.delete('/:id/block', asyncHandler(async (req, res) => {
  const conversation = await findParticipantConversation(req.params.id, req.user.id)
  await updateBlock(conversation, req.user.id, false)
  res.json(new ApiResponse(200, null, 'User unblocked'))
}))

export default router
