import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'


export const generateAccessToken = (userId, sessionId) => {
  return jwt.sign(
    {
      sub: userId,
      sid: sessionId,
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.ACCESS_TOKEN_EXPIRES }
  )
}


export const generateRefreshToken = (userId, sessionId) => {
  return jwt.sign(
    { sub: userId, sid: sessionId, type: 'refresh' },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.REFRESH_TOKEN_EXPIRES }
  )
}

export const verifyAccessToken = (token) => {
  return jwt.verify(token, env.JWT_ACCESS_SECRET)
}

export const verifyRefreshToken = (token) => {
  const payload = jwt.verify(token, env.JWT_REFRESH_SECRET)

  if (payload.type !== 'refresh' || !payload.sid) {
    throw new Error('Invalid refresh token')
  }

  return payload
}
