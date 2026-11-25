import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'

import redis from '../../config/redis.js'
import { env } from '../../config/env.js'
import { sendMail } from '../../services/mail.service.js'
import { revokeAllUserSessions } from '../../services/session.service.js'
import { disconnectUser } from '../../realtime/socket.js'
import ApiError from '../../utils/ApiError.js'
import User from '../users/user.model.js'

const CODE_TTL_SECONDS = 10 * 60
const RESEND_COOLDOWN_SECONDS = 60
const MAX_ATTEMPTS = 5

const codeKey = (email) => `password-reset:${email}`
const cooldownKey = (email) => `password-reset-cooldown:${email}`
const tokenKey = (email) => `password-reset-token:${email}`

// Only keyed hashes are stored, so a Redis dump does not reveal live codes or tokens
const hashSecret = (email, secret) => createHmac('sha256', env.JWT_REFRESH_SECRET).update(`${email}:${secret}`).digest()

const sameHash = (savedHex, email, secret) => {
  const saved = Buffer.from(savedHex ?? '', 'hex')
  const given = hashSecret(email, secret)
  return saved.length === given.length && timingSafeEqual(saved, given)
}

const invalidCode = () => ApiError.validation({ otp: 'This code is wrong or has expired. Request a new one.' })

/**
 * Emails a 6-digit code when the account exists. The response is the same either way,
 * so the form cannot be used to find out which emails are registered.
 */
export const requestPasswordReset = async (email) => {
  const allowed = await redis.set(cooldownKey(email), '1', 'EX', RESEND_COOLDOWN_SECONDS, 'NX')
  if (!allowed) throw new ApiError(429, 'Please wait a minute before asking for another code.')

  const user = await User.findOne({ email, status: 'active' }).select('name email')
  if (!user) return

  const code = randomInt(0, 1_000_000).toString().padStart(6, '0')
  await redis.multi()
    .hset(codeKey(email), 'hash', hashSecret(email, code).toString('hex'), 'attempts', 0)
    .expire(codeKey(email), CODE_TTL_SECONDS)
    .exec()

  try {
    await sendMail({
      to: user.email,
      subject: `${code} is your Finovo Souq password reset code`,
      text: `Hi ${user.name},\n\nYour password reset code is ${code}. It expires in 10 minutes.\n\nIf you did not ask to reset your password, you can ignore this email. Your password will not change.\n\nFinovo Souq`,
      html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#1f1d2b">
  <h2 style="color:#6c47ff;margin:0 0 16px">Finovo Souq</h2>
  <p>Hi ${user.name.replace(/[<>&"]/g, '')},</p>
  <p>Use this code to reset your password. It expires in 10 minutes.</p>
  <p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:24px 0">${code}</p>
  <p style="color:#6b6b80;font-size:13px">If you did not ask to reset your password, you can ignore this email. Your password will not change.</p>
</div>`,
    })
  } catch (error) {
    await redis.del(codeKey(email), cooldownKey(email))
    throw error
  }
}

/** Checks the emailed code and swaps it for a one-time token that allows setting the new password */
export const verifyResetCode = async (email, otp) => {
  const saved = await redis.hgetall(codeKey(email))
  if (!saved.hash) throw invalidCode()

  const attempts = await redis.hincrby(codeKey(email), 'attempts', 1)
  if (attempts > MAX_ATTEMPTS) {
    await redis.del(codeKey(email))
    throw ApiError.validation({ otp: 'Too many wrong tries. Request a new code.' })
  }

  if (!sameHash(saved.hash, email, otp)) throw invalidCode()

  const resetToken = randomBytes(32).toString('hex')
  await redis.multi()
    .del(codeKey(email))
    .set(tokenKey(email), hashSecret(email, resetToken).toString('hex'), 'EX', CODE_TTL_SECONDS)
    .exec()

  return resetToken
}

/** Sets the new password and signs the account out everywhere */
export const resetPassword = async ({ email, resetToken, password }) => {
  const expired = new ApiError(400, 'Your reset session has expired. Please request a new code.')
  if (!sameHash(await redis.get(tokenKey(email)), email, resetToken)) throw expired

  const user = await User.findOne({ email, status: 'active' })
  if (!user) throw expired

  user.password = password
  await user.save()
  await redis.del(tokenKey(email))
  await revokeAllUserSessions(user._id)
  disconnectUser(user._id)
}
