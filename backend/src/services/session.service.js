
import crypto from 'node:crypto'
import Session from '../models/session.model.js'

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex')
}


export const createSession = async ({
  sessionId,
  userId,
  refreshToken,
  userAgent,
  ipAddress,
  expiresAt,
}) => {
  const session = await Session.create({
    _id: sessionId,
    userId,
    refreshTokenHash: hashToken(refreshToken),
    userAgent,
    ipAddress,
    expiresAt,
  })

  return session
}


export const verifySession = async (sessionId, refreshToken) => {
  const session = await Session.findById(sessionId)
    .select('+refreshTokenHash')

  if (!session) return null
  if (session.revokedAt) return null
  if (session.expiresAt <= new Date()) return null

  const tokenHash = hashToken(refreshToken)

  const isValid = crypto.timingSafeEqual(
    Buffer.from(session.refreshTokenHash, 'hex'),
    Buffer.from(tokenHash, 'hex')
  )

  return isValid ? session : null
}


export const revokeSession = async (sessionId, userId) => {
  return Session.findOneAndUpdate(
    {
      _id: sessionId,
      userId,
      revokedAt: null,
    },
    {
      revokedAt: new Date(),
    },
    {
      new: true,
    }
  )
}


export const revokeAllUserSessions = async (userId) => {
  return Session.updateMany(
    { userId, revokedAt: null },
    { revokedAt: new Date() }
  )
}

export const rotateSessionToken = async (
  sessionId,
  oldRefreshToken,
  newRefreshToken,
  expiresAt
) => {
  const session = await verifySession(sessionId, oldRefreshToken)

  if (!session) return false

  const oldHash = hashToken(oldRefreshToken)
  const newHash = hashToken(newRefreshToken)

  // Atomically replace the old token hash
  const result = await Session.updateOne(
    {
      _id: sessionId,
      refreshTokenHash: oldHash,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    },
    {
      $set: {
        refreshTokenHash: newHash,
        expiresAt,
      },
    }
  )

  return result.modifiedCount === 1
}


export const isSessionActive = async (sessionId, userId) => {
  const session = await Session.findOne({
    _id: sessionId,
    userId,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  })

  return Boolean(session)
}
