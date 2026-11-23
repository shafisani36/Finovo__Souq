
import { verifyAccessToken } from '../services/jwt.service.js'
import User from '../modules/users/user.model.js'
import { isSessionActive } from '../services/session.service.js'

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const error = new Error('Authentication required')
      error.statusCode = 401
      throw error
    }

    const token = authHeader.split(' ')[1]

    if (!token) {
      const error = new Error('Access token is required')
      error.statusCode = 401
      throw error
    }

    const decoded = verifyAccessToken(token)

    if (!decoded.sid || !decoded.sub) {
      const error = new Error('Invalid access token session')
      error.statusCode = 401
      throw error
    }

    const sessionIsActive = await isSessionActive(
      decoded.sid,
      decoded.sub
    )

    if (!sessionIsActive) {
      const error = new Error('Session expired or revoked')
      error.statusCode = 401
      throw error
    }

    const user = await User.findById(decoded.sub).select(
      '_id name email role status'
    )

    if (!user || user.status !== 'active') {
      const error = new Error('Invalid or inactive user')
      error.statusCode = 401
      throw error
    }

    req.user = {
      id: user._id.toString(),
      role: user.role,
    }

    next()
  } catch (error) {
    if (
      ['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(
        error.name
      )
    ) {
      error.statusCode = 401
    }

    next(error)
  }
}

export default authenticate
