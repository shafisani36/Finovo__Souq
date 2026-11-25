import Notification from '../modules/notifications/notification.model.js'
import { emitToUser } from '../realtime/socket.js'

/** Saves a notification and pushes it to the user's open tabs */
export const notify = async (userId, { type, title, body, link = null }) => {
  const notification = await Notification.create({ user: userId, type, title, body, link })
  emitToUser(userId.toString(), 'notification:new', notification.toJSON())
  return notification
}
