import { Router } from 'express'
import authenticate from '../../middleware/authenticate.js'
import asyncHandler from '../../utils/asyncHandler.js'
import ApiResponse from '../../utils/ApiResponse.js'
import Notification from './notification.model.js'

const router = Router()
router.use(authenticate)

router.get('/', asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(50)
  res.json(new ApiResponse(200, notifications))
}))

router.patch('/read-all', asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user.id, read: false }, { read: true })
  res.json(new ApiResponse(200, null))
}))

router.patch('/:id/read', asyncHandler(async (req, res) => {
  await Notification.updateOne({ _id: req.params.id, user: req.user.id }, { read: true })
  res.json(new ApiResponse(200, null))
}))

export default router
