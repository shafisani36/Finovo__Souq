import express, { Router } from 'express'
import authenticate from '../../middleware/authenticate.js'
import authorize from '../../middleware/authorize.js'
import { writeLimiter } from '../../middleware/rateLimiter.js'
import { paymentsAvailable } from '../../services/stripe.service.js'
import asyncHandler from '../../utils/asyncHandler.js'
import ApiResponse from '../../utils/ApiResponse.js'
import ApiError from '../../utils/ApiError.js'
import { env } from '../../config/env.js'
import User from '../users/user.model.js'
import { confirmCheckout, handleStripeEvent, startPromotionCheckout } from './payments.service.js'

const router = Router()

router.post('/promotions', authenticate, authorize('user'), writeLimiter, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('email')
  if (!user) throw ApiError.notFound('User not found')
  res.status(201).json(new ApiResponse(201, await startPromotionCheckout(user, req.body.listingId, req.body.days), 'Payment page ready'))
}))

router.get('/promotions/confirm', authenticate, asyncHandler(async (req, res) => {
  res.json(new ApiResponse(200, await confirmCheckout(req.user.id, req.query.session_id)))
}))

export default router

/** Mounted before express.json(): Stripe signs the exact bytes it sent */
export const stripeWebhookRouter = Router()

stripeWebhookRouter.post('/', express.raw({ type: 'application/json', limit: '1mb' }), asyncHandler(async (req, res) => {
  if (!paymentsAvailable() || !env.STRIPE_WEBHOOK_SECRET) throw new ApiError(503, 'Payments are not configured')
  await handleStripeEvent(req.body, req.get('stripe-signature'))
  res.json({ received: true })
}))
