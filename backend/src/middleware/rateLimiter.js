
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'

const limiter = (windowMs, limit, message, byUser = false) => rateLimit({
  windowMs,
  limit,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  // Signed-in actions are limited per account, so people on one shared network do not block each other
  ...(byUser && { keyGenerator: (req) => req.user?.id ?? ipKeyGenerator(req.ip) }),
  message: { success: false, message },
})

export const authLimiter = limiter(15 * 60 * 1000, 10, 'Too many requests. Please try again after 15 minutes.')

export const messageLimiter = limiter(60 * 1000, 30, 'You are sending messages too quickly. Please wait a moment.', true)

export const uploadLimiter = limiter(10 * 60 * 1000, 60, 'Too many uploads. Please try again in a few minutes.', true)

export const writeLimiter = limiter(10 * 60 * 1000, 100, 'Too many changes. Please try again in a few minutes.', true)

export const publicFormLimiter = limiter(60 * 60 * 1000, 10, 'Too many requests. Please try again later.')
