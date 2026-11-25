
import { verifyAccessToken } from '../services/jwt.service.js'
import User from '../modules/users/user.model.js'
import { isSessionActive } from '../services/session.service.js'

const unauthorized = (message) => {
  const error = new Error(message)
  error.statusCode = 401
  return error
}

/**
 * Checks an access token, its session and the account behind it.
 * Shared by HTTP requests and Socket.IO connections.
 */
export const getUserFromToken = async (token) => {
  if (!token) throw unauthorized('Access token is required')

  let decoded
  try {
    decoded = verifyAccessToken(token)
  } catch {
    throw unauthorized('Invalid or expired access token')
  }

  if (!decoded.sid || !decoded.sub) {
    throw unauthorized('Invalid access token session')
  }

  const sessionIsActive = await isSessionActive(decoded.sid, decoded.sub)

  if (!sessionIsActive) {
    throw unauthorized('Session expired or revoked')
  }

  const user = await User.findById(decoded.sub).select('_id role status accountType')

  if (!user || user.status !== 'active') {
    throw unauthorized('Invalid or inactive user')
  }

  return { id: user._id.toString(), role: user.role, accountType: user.accountType }
}

const bearerToken = (req) => {
  const authHeader = req.headers.authorization
  return authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null
}

const authenticate = async (req, res, next) => {
  try {
    const token = bearerToken(req)
    if (!token) throw unauthorized('Authentication required')
    req.user = await getUserFromToken(token)
    next()
  } catch (error) {
    next(error)
  }
}

/** For public pages that show more to the owner or an admin; an invalid token is treated as a guest */
export const optionalAuthenticate = async (req, res, next) => {
  const token = bearerToken(req)
  if (token) {
    try {
      req.user = await getUserFromToken(token)
    } catch {
      req.user = undefined
    }
  }
  next()
}

export default authenticate
