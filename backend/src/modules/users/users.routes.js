import { Router } from 'express'
import authenticate from '../../middleware/authenticate.js'
import { avatarUpload } from '../../middleware/upload.js'
import { uploadLimiter, writeLimiter } from '../../middleware/rateLimiter.js'
import asyncHandler from '../../utils/asyncHandler.js'
import ApiResponse from '../../utils/ApiResponse.js'
import ApiError from '../../utils/ApiError.js'
import { toText } from '../../utils/pagination.js'
import { SAUDI_CITIES } from '../../config/catalog.js'
import { saveImage, removeFile } from '../../services/storage.service.js'
import { notify } from '../../services/notification.service.js'
import User from './user.model.js'

const router = Router()
router.use(authenticate)

const SAUDI_MOBILE = /^\+9665\d{8}$/

const findMe = async (req) => {
  const user = await User.findById(req.user.id)
  if (!user) throw ApiError.notFound('User not found')
  return user
}

router.get('/me', asyncHandler(async (req, res) => {
  res.json(new ApiResponse(200, await findMe(req)))
}))

router.patch('/me', writeLimiter, asyncHandler(async (req, res) => {
  const user = await findMe(req)
  const errors = {}

  if (req.body.name !== undefined) {
    const name = toText(req.body.name)
    if (name.length < 2 || name.length > 60) errors.name = 'Name must be 2 to 60 characters'
    else user.name = name
  }
  if (req.body.phone !== undefined) {
    const phone = toText(req.body.phone)
    if (phone && !SAUDI_MOBILE.test(phone)) errors.phone = 'Enter a Saudi mobile number like +9665XXXXXXXX'
    else user.phone = phone || null
  }
  if (req.body.city !== undefined) {
    const city = toText(req.body.city)
    if (city && !SAUDI_CITIES.includes(city)) errors.city = 'Choose a city from the list'
    else user.city = city || null
  }
  if (Object.keys(errors).length) throw ApiError.validation(errors)

  await user.save()
  res.json(new ApiResponse(200, user, 'Profile updated'))
}))

router.post('/me/avatar', uploadLimiter, avatarUpload, asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.validation({ avatar: 'Choose a photo' })
  const user = await findMe(req)
  const saved = await saveImage(req.file.buffer, 'public/avatars', 'avatar')
  const oldKey = user.avatarKey
  user.avatarKey = saved.key
  await user.save()
  await removeFile(oldKey)
  res.json(new ApiResponse(200, user, 'Profile photo updated'))
}))

router.delete('/me/avatar', asyncHandler(async (req, res) => {
  const user = await findMe(req)
  const oldKey = user.avatarKey
  user.avatarKey = null
  await user.save()
  await removeFile(oldKey)
  res.json(new ApiResponse(200, user, 'Profile photo removed'))
}))

// The team reviews the request and deletes the account; until then the person can cancel it
router.post('/me/deletion-request', writeLimiter, asyncHandler(async (req, res) => {
  const user = await findMe(req)
  if (user.role === 'admin') throw new ApiError(409, 'Admin accounts cannot be deleted this way')
  const firstRequest = !user.deletionRequestedAt
  user.deletionRequestedAt ??= new Date()
  user.deletionReason = toText(req.body.reason).slice(0, 500) || null
  await user.save()

  if (firstRequest) {
    const admins = await User.find({ role: 'admin', status: 'active' }).select('_id').lean()
    await Promise.all(admins.map((admin) => notify(admin._id, {
      type: 'system',
      title: 'Account deletion request',
      body: `${user.name} asked for their account to be deleted.`,
      link: '/admin/users?deletion=requested',
    })))
  }
  res.json(new ApiResponse(200, { deletionRequestedAt: user.deletionRequestedAt }, 'Deletion request received. Our team will process it within 30 days.'))
}))

router.delete('/me/deletion-request', writeLimiter, asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user.id }, { $set: { deletionRequestedAt: null, deletionReason: null } })
  res.json(new ApiResponse(200, null, 'Deletion request cancelled'))
}))

export default router
