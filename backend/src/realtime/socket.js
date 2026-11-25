import { Server } from 'socket.io'
import { env } from '../config/env.js'
import { getUserFromToken } from '../middleware/authenticate.js'
import Conversation from '../modules/chat/conversation.model.js'

let io = null
const TYPING_INTERVAL_MS = 1500

const room = (userId) => `user:${userId}`

/**
 * Live updates only. Every change still goes through the REST API (validation, rate limits);
 * the socket just tells the right people that something happened. Each user listens only
 * to their own private room, so nobody receives another person's events.
 */
export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: { origin: env.CLIENT_URL, credentials: true },
    maxHttpBufferSize: 10_000,
  })

  io.use(async (socket, next) => {
    try {
      socket.data.user = await getUserFromToken(socket.handshake.auth?.token)
      next()
    } catch {
      next(new Error('Unauthorized'))
    }
  })

  io.on('connection', (socket) => {
    const userId = socket.data.user.id
    socket.join(room(userId))
    const lastTyping = new Map()

    socket.on('typing', async (payload) => {
      const conversationId = typeof payload?.conversationId === 'string' ? payload.conversationId : null
      const now = Date.now()
      if (!conversationId || now - (lastTyping.get(conversationId) ?? 0) < TYPING_INTERVAL_MS) return
      lastTyping.set(conversationId, now)

      const conversation = await Conversation.findOne({
        _id: conversationId,
        $or: [{ buyer: userId }, { seller: userId }],
        blockedBy: { $size: 0 },
      }).select('buyer seller').lean().catch(() => null)
      if (!conversation) return

      const otherId = conversation.buyer.toString() === userId ? conversation.seller : conversation.buyer
      emitToUser(otherId.toString(), 'typing', { conversationId, userId })
    })
  })

  return io
}

export const emitToUser = (userId, event, payload) => {
  io?.to(room(userId)).emit(event, payload)
}

/** Closes live connections of a user whose account was suspended */
export const disconnectUser = (userId) => {
  io?.in(room(userId)).disconnectSockets(true)
}
