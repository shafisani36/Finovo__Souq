import { Router } from 'express'
import mongoose from 'mongoose'
import { publicFormLimiter } from '../../middleware/rateLimiter.js'
import asyncHandler from '../../utils/asyncHandler.js'
import ApiResponse from '../../utils/ApiResponse.js'
import ApiError from '../../utils/ApiError.js'
import { toText } from '../../utils/pagination.js'

const TOPICS = ['Buying an item', 'Selling or my ads', 'My account', 'Report a problem', 'Something else']

const SupportMessage = mongoose.model('SupportMessage', new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true },
    topic: { type: String, enum: TOPICS, required: true },
    message: { type: String, required: true },
    status: { type: String, enum: ['new', 'answered'], default: 'new' },
  },
  { timestamps: true }
))

const router = Router()

router.post('/messages', publicFormLimiter, asyncHandler(async (req, res) => {
  const name = toText(req.body.name)
  const email = toText(req.body.email).toLowerCase()
  const message = toText(req.body.message)
  const errors = {}
  if (name.length < 2 || name.length > 60) errors.name = 'Enter your name'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address'
  if (!TOPICS.includes(req.body.topic)) errors.topic = 'Choose a topic'
  if (message.length < 20 || message.length > 2000) errors.message = 'Write 20 to 2000 characters'
  if (Object.keys(errors).length) throw ApiError.validation(errors)

  const saved = await SupportMessage.create({ name, email, topic: req.body.topic, message })
  res.status(201).json(new ApiResponse(201, { id: saved.id, receivedAt: saved.createdAt }, 'Message received'))
}))

export default router
