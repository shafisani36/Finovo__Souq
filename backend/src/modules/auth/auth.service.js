import User from '../users/user.model.js'
import mongoose from 'mongoose'
import {
  generateAccessToken,
  generateRefreshToken,
   verifyRefreshToken,
} from '../../services/jwt.service.js'

import {
  createSession,
  revokeSession,
  revokeAllUserSessions,
    rotateSessionToken,
} from '../../services/session.service.js'

import { env } from '../../config/env.js'
import { notify } from '../../services/notification.service.js'

const createAuthTokens = async (user, req) => {
  const sessionId = new mongoose.Types.ObjectId().toString()

  const refreshToken = generateRefreshToken(
    user._id.toString(),
    sessionId
  )

  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000
  )

  await createSession({
    sessionId,
    userId: user._id,
    refreshToken,
    userAgent: req.get('user-agent'),
    ipAddress: req.ip,
    expiresAt,
  })

  const accessToken = generateAccessToken(
  user._id.toString(),
  sessionId
)

  return {
    accessToken,
    refreshToken,
    sessionId,
  }
}

export const registerUser = async (data, req) => {
  const { name, email, password, phone, accountType = 'buyer' } = data

  const existingUser = await User.findOne({
    email: email.toLowerCase().trim(),
  })

  if (existingUser) {
    const error = new Error('Email is already registered')
    error.statusCode = 409
    throw error
  }

  const isSeller = accountType === 'seller'
  const user = await User.create({
    name,
    email,
    password,
    phone,
    accountType,
    status: isSeller ? 'pending' : 'active',
  })

  // A seller can sign in only after an admin approves the account
  if (isSeller) {
    const admins = await User.find({ role: 'admin', status: 'active' }).select('_id')
    await Promise.all(admins.map((admin) => notify(admin._id, {
      type: 'system',
      title: 'New seller waiting for approval',
      body: `${user.name} (${user.email}) signed up as a seller.`,
      link: '/admin/users?status=pending',
    })))
    return { user: user.toJSON(), pendingApproval: true }
  }

  const tokens = await createAuthTokens(user, req)

  return {
    user: user.toJSON(),
    ...tokens,
  }
}

export const loginUser = async (data, req) => {
  const email = data.email.toLowerCase().trim()

  const user = await User.findOne({ email }).select('+password')

  if (!user) {
    const error = new Error('Invalid email or password')
    error.statusCode = 401
    throw error
  }

  const isPasswordValid = await user.comparePassword(data.password)

  if (!isPasswordValid) {
    const error = new Error('Invalid email or password')
    error.statusCode = 401
    throw error
  }

  // Checked after the password, so the account state is only shown to its owner
  if (user.status !== 'active') {
    const error = new Error(user.status === 'pending'
      ? 'Your seller account is waiting for admin approval. We will email you once it is approved.'
      : 'Your account is suspended')
    error.statusCode = 403
    throw error
  }

  const tokens = await createAuthTokens(user, req)

  return {
    user: user.toJSON(),
    ...tokens,
  }
}


export const logoutUser = async (sessionId, userId) => {
  const session = await revokeSession(sessionId, userId)

  if (!session) {
    const error = new Error('Session not found or already revoked')
    error.statusCode = 404
    throw error
  }

  return {
    message: 'Logged out successfully',
  }
}


export const logoutAllDevices = async (userId) => {
  await revokeAllUserSessions(userId)

  return {
    message: 'All sessions revoked successfully',
  }
}



export const refreshUserTokens = async (refreshToken) => {
  if (!refreshToken) {
    const error = new Error('Refresh token is required')
    error.statusCode = 401
    throw error
  }

  let payload

  try {
    payload = verifyRefreshToken(refreshToken)
  } catch {
    const error = new Error('Invalid or expired refresh token')
    error.statusCode = 401
    throw error
  }

  const user = await User.findById(payload.sub)

  if (!user || user.status !== 'active') {
    const error = new Error('User not found or inactive')
    error.statusCode = 401
    throw error
  }

  const newRefreshToken = generateRefreshToken(
    user._id.toString(),
    payload.sid
  )

  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000
  )

  const rotated = await rotateSessionToken(
    payload.sid,
    refreshToken,
    newRefreshToken,
    expiresAt
  )

  if (!rotated) {
    const error = new Error('Refresh token is invalid or already used')
    error.statusCode = 401
    throw error
  }

  const accessToken = generateAccessToken(
  user._id.toString(),
  payload.sid
)

  return {
    user: user.toJSON(),
    accessToken,
    refreshToken: newRefreshToken,
  }
}
