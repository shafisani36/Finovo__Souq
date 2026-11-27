import { env } from '../../config/env.js'
import { sendMail } from '../../services/mail.service.js'
import { notify } from '../../services/notification.service.js'
import { paymentsAvailable, stripe } from '../../services/stripe.service.js'
import ApiError from '../../utils/ApiError.js'
import { errorFields, logger } from '../../utils/logger.js'
import Listing, { PUBLIC_FILTER } from '../listings/listing.model.js'
import { getSettings } from '../settings/settings.service.js'
import Payment, { nextInvoiceNumber } from './payment.model.js'
import User from '../users/user.model.js'

const DAY_MS = 24 * 60 * 60 * 1000
// Stripe's shortest allowed Checkout lifetime is 30 minutes
const CHECKOUT_LIFETIME_SECONDS = 31 * 60

export const toPaymentView = (p) => ({
  id: p._id.toString(),
  listingId: p.listing?._id?.toString() ?? p.listing?.toString() ?? null,
  listingTitle: p.listing?.title ?? null,
  user: p.user?.name ? { id: p.user._id.toString(), name: p.user.name, email: p.user.email } : null,
  days: p.days,
  amount: p.amount / 100,
  currency: p.currency.toUpperCase(),
  status: p.status,
  paidAt: p.paidAt,
  featuredUntil: p.featuredUntil,
  invoiceNumber: p.invoiceNumber ?? null,
  invoiceSent: Boolean(p.invoiceSentAt),
  reviewedAt: p.reviewedAt ?? null,
  note: p.note,
  createdAt: p.createdAt,
})

/** Opens a Stripe Checkout page for featuring one of the seller's live ads; returns the page address */
export const startPromotionCheckout = async (user, listingId, days) => {
  const settings = await getSettings()
  if (!paymentsAvailable() || !settings.promotions?.enabled) throw new ApiError(503, 'Paid promotion is not available right now')
  const pack = settings.promotions.packages.find((p) => p.days === Number(days))
  if (!pack) throw ApiError.validation({ days: 'Choose one of the promotion packages' })

  const listing = await Listing.findOne({ _id: listingId, seller: user._id, ...PUBLIC_FILTER }).select('title')
  if (!listing) throw new ApiError(409, 'Only your live, available ads can be promoted')

  // The price is read from the settings on the server, never from the browser
  const payment = await Payment.create({ user: user._id, listing: listing._id, days: pack.days, amount: pack.price * 100 })
  const back = `${env.CLIENT_URL}/account/listings`
  try {
    const session = await stripe().checkout.sessions.create({
      mode: 'payment',
      customer_email: user.email,
      client_reference_id: payment.id,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'sar',
          unit_amount: payment.amount,
          product_data: { name: `Featured ad for ${pack.days} days`, description: listing.title.slice(0, 200) },
        },
      }],
      metadata: { paymentId: payment.id, listingId: listing.id, days: String(pack.days) },
      payment_intent_data: { metadata: { paymentId: payment.id } },
      success_url: `${back}?promotion=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${back}?promotion=cancelled`,
      expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_LIFETIME_SECONDS,
    }, { idempotencyKey: `promotion-${payment.id}` })

    payment.stripeSessionId = session.id
    await payment.save()
    return { url: session.url }
  } catch (error) {
    payment.status = 'failed'
    payment.note = 'Checkout could not be opened'
    await payment.save()
    logger.error('stripe checkout failed', { paymentId: payment.id, ...errorFields(error) })
    throw new ApiError(502, 'We could not open the payment page. Please try again in a moment.')
  }
}

/** Adds the paid days to the ad, after any promotion it already has; keeps the ad live at least that long */
const featureListing = (listingId, days) => Listing.findOneAndUpdate(
  { _id: listingId, ...PUBLIC_FILTER },
  [
    { $set: { featuredUntil: { $add: [{ $max: ['$featuredUntil', '$$NOW'] }, days * DAY_MS] } } },
    { $set: { expiresAt: { $cond: [{ $gt: ['$featuredUntil', '$expiresAt'] }, '$featuredUntil', '$expiresAt'] } } },
  ],
  { returnDocument: 'after', updatePipeline: true }
)

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const money = (halalas, currency) => `${(halalas / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency.toUpperCase()}`
const dateText = (date) => date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Riyadh' })

/** Emails the paid invoice; a failed email never undoes the payment, and the time it went out is recorded */
const sendInvoice = async (payment, user, listing) => {
  const total = money(payment.amount, payment.currency)
  const item = `Featured ad for ${payment.days} days`
  const rows = [
    ['Invoice number', payment.invoiceNumber],
    ['Date paid', dateText(payment.paidAt)],
    ['Billed to', `${user.name} (${user.email})`],
    ['Payment method', 'Card, through Stripe'],
    ['Payment reference', payment.stripePaymentIntentId ?? payment.id],
  ]
  try {
    await sendMail({
      to: user.email,
      subject: `Invoice ${payment.invoiceNumber}: payment received`,
      text: [
        `Hi ${user.name},`,
        '',
        'Thank you, we received your payment. Our team will check your ad and start the promotion soon; we will let you know when it is live.',
        '',
        ...rows.map(([label, value]) => `${label}: ${value}`),
        '',
        `${item}: "${listing.title}"`,
        `Total paid: ${total}`,
        '',
        'If the promotion is not approved, the full amount is refunded to your card.',
        '',
        'Finovo Souq',
      ].join('\n'),
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1f1d2b">
  <h2 style="color:#6c47ff;margin:0 0 4px">Finovo Souq</h2>
  <p style="margin:0 0 20px;color:#6b6b80">Invoice &middot; <strong style="color:#1a7f4b">PAID</strong></p>
  <p>Hi ${escapeHtml(user.name)},</p>
  <p>Thank you, we received your payment. Our team will check your ad and start the promotion soon; we will let you know when it is live.</p>
  <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px">
    ${rows.map(([label, value]) => `<tr><td style="padding:6px 0;color:#6b6b80">${label}</td><td style="padding:6px 0;text-align:right">${escapeHtml(value)}</td></tr>`).join('')}
  </table>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    <tr style="background:#f4f2ff"><th style="padding:10px;text-align:left">Item</th><th style="padding:10px;text-align:right">Amount</th></tr>
    <tr><td style="padding:10px;border-bottom:1px solid #eaeaf0">${item}<br><span style="color:#6b6b80">${escapeHtml(listing.title)}</span></td><td style="padding:10px;text-align:right;border-bottom:1px solid #eaeaf0">${total}</td></tr>
    <tr><td style="padding:10px;text-align:right"><strong>Total paid</strong></td><td style="padding:10px;text-align:right"><strong>${total}</strong></td></tr>
  </table>
  <p style="color:#6b6b80;font-size:13px;margin-top:24px">If the promotion is not approved, the full amount is refunded to your card.</p>
</div>`,
    })
    await Payment.updateOne({ _id: payment._id }, { $set: { invoiceSentAt: new Date() } })
  } catch {
    logger.warn('invoice email not sent', { paymentId: payment.id })
  }
}

/** Gives the money back through Stripe; returns false if Stripe refused, so the team can refund by hand */
const refund = async (payment) => {
  try {
    await stripe().refunds.create({ payment_intent: payment.stripePaymentIntentId }, { idempotencyKey: `refund-${payment.id}` })
    return true
  } catch (error) {
    logger.error('stripe refund failed', { paymentId: payment.id, ...errorFields(error) })
    return false
  }
}

/**
 * Records a paid Checkout session exactly once; safe to call from the webhook and the return page at the same time.
 * The ad is not featured yet: an admin approves the promotion first. The seller gets an invoice by email.
 */
export const fulfilCheckoutSession = async (session) => {
  if (session.payment_status !== 'paid') return null
  const payment = await Payment.findOne({ stripeSessionId: session.id })
  if (!payment) {
    logger.warn('stripe session without payment', { sessionId: session.id })
    return null
  }
  if (session.amount_total !== payment.amount || session.currency !== payment.currency) {
    logger.error('stripe amount mismatch', { paymentId: payment.id })
    return payment
  }

  const claimed = await Payment.findOneAndUpdate(
    { _id: payment._id, status: { $in: ['pending', 'expired', 'failed'] } },
    { $set: { status: 'paid', paidAt: new Date(), stripePaymentIntentId: session.payment_intent ?? null } },
    { returnDocument: 'after' }
  )
  if (!claimed) return payment

  claimed.invoiceNumber = await nextInvoiceNumber(claimed.paidAt)
  await claimed.save()

  const [user, listing, admins] = await Promise.all([
    User.findById(claimed.user).select('name email').lean(),
    Listing.findById(claimed.listing).select('title').lean(),
    User.find({ role: 'admin', status: 'active' }).select('_id').lean(),
  ])
  await notify(claimed.user, {
    type: 'system',
    title: 'Payment received',
    body: `Our team will check "${listing?.title ?? 'your ad'}" and start the ${claimed.days}-day promotion soon. Your invoice is in your email.`,
    link: '/account/listings',
  })
  await Promise.all(admins.map((admin) => notify(admin._id, {
    type: 'system',
    title: 'Paid promotion to approve',
    body: `${user?.name ?? 'A seller'} paid for a ${claimed.days}-day promotion of "${listing?.title ?? 'an ad'}".`,
    link: '/admin/promotions',
  })))
  if (user && listing) await sendInvoice(claimed, user, listing)
  logger.info('promotion paid', { paymentId: claimed.id, days: claimed.days })
  return claimed
}

/** Admin approval: the paid days start now. If the ad went offline meanwhile, the payment is refunded instead */
export const approvePromotion = async (paymentId, adminId) => {
  const payment = await Payment.findOneAndUpdate(
    { _id: paymentId, status: 'paid' },
    { $set: { status: 'approved', reviewedBy: adminId, reviewedAt: new Date() } },
    { returnDocument: 'after' }
  )
  if (!payment) throw new ApiError(409, 'Only paid promotions waiting for approval can be approved')

  const listing = await featureListing(payment.listing, payment.days)
  if (!listing) {
    payment.set({ status: 'paid', reviewedBy: null, reviewedAt: null })
    await payment.save()
    throw new ApiError(409, 'This ad is no longer live. Reject the promotion to refund the seller.')
  }
  payment.featuredUntil = listing.featuredUntil
  await payment.save()
  await notify(payment.user, {
    type: 'listing_featured',
    title: 'Your ad is featured',
    body: `"${listing.title}" is shown at the top of search for ${payment.days} days.`,
    link: `/listings/${listing.id}`,
  })
  return payment
}

/** Admin rejection: the full amount goes back to the seller's card */
export const rejectPromotion = async (paymentId, adminId, reason) => {
  const payment = await Payment.findOneAndUpdate(
    { _id: paymentId, status: 'paid' },
    { $set: { status: 'refunded', reviewedBy: adminId, reviewedAt: new Date(), note: reason } },
    { returnDocument: 'after' }
  )
  if (!payment) throw new ApiError(409, 'Only paid promotions waiting for approval can be rejected')

  if (!(await refund(payment))) {
    payment.set({ status: 'paid', reviewedBy: null, reviewedAt: null })
    payment.note = 'The automatic refund failed. Try again, or refund it in the Stripe dashboard.'
    await payment.save()
    throw new ApiError(502, 'Stripe could not refund this payment. Try again in a moment.')
  }
  await notify(payment.user, {
    type: 'system',
    title: 'Promotion not approved',
    body: `${reason} The full amount of ${money(payment.amount, payment.currency)} has been refunded to your card.`,
    link: '/account/listings',
  })
  return payment
}

/** Called when the seller lands back on the site, so the promotion shows at once even before the webhook arrives */
export const confirmCheckout = async (userId, sessionId) => {
  if (typeof sessionId !== 'string' || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) throw ApiError.notFound('Payment not found')
  const payment = await Payment.findOne({ stripeSessionId: sessionId, user: userId })
  if (!payment) throw ApiError.notFound('Payment not found')
  if (payment.status === 'pending') {
    const session = await stripe().checkout.sessions.retrieve(sessionId)
    return toPaymentView((await fulfilCheckoutSession(session)) ?? payment)
  }
  return toPaymentView(payment)
}

/** Stripe webhook: the signature proves the event came from Stripe */
export const handleStripeEvent = async (rawBody, signature) => {
  let event
  try {
    event = stripe().webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET)
  } catch {
    throw new ApiError(400, 'Invalid signature')
  }

  const session = event.data.object
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      await fulfilCheckoutSession(session)
      break
    case 'checkout.session.expired':
      await Payment.updateOne({ stripeSessionId: session.id, status: 'pending' }, { $set: { status: 'expired' } })
      break
    case 'checkout.session.async_payment_failed':
      await Payment.updateOne({ stripeSessionId: session.id, status: 'pending' }, { $set: { status: 'failed', note: 'The bank declined the payment' } })
      break
    default:
      break
  }
}
