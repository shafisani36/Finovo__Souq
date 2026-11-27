import Stripe from 'stripe'
import { env } from '../config/env.js'

let client = null

export const paymentsAvailable = () => Boolean(env.STRIPE_SECRET_KEY)

/** One shared Stripe client; network errors are retried twice by the SDK */
export const stripe = () => {
  if (!client) client = new Stripe(env.STRIPE_SECRET_KEY, { maxNetworkRetries: 2, timeout: 20_000 })
  return client
}
