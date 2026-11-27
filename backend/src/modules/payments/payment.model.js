import mongoose from 'mongoose'

// pending: in Stripe Checkout · paid: money received, waiting for an admin · approved: ad featured
export const PAYMENT_STATUSES = ['pending', 'paid', 'approved', 'refunded', 'expired', 'failed']

/** A seller's payment for featuring an ad; amounts are in halalas (1 SAR = 100) as Stripe expects */
const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
    purpose: { type: String, enum: ['promotion'], default: 'promotion' },
    days: { type: Number, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'sar' },
    status: { type: String, enum: PAYMENT_STATUSES, default: 'pending' },
    stripeSessionId: { type: String, default: null },
    stripePaymentIntentId: { type: String, default: null },
    paidAt: { type: Date, default: null },
    featuredUntil: { type: Date, default: null },
    // Sequential number printed on the emailed invoice, e.g. FS-2026-000042
    invoiceNumber: { type: String, default: null },
    invoiceSentAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    // Why a paid promotion was refunded, e.g. the ad was removed before the payment arrived
    note: { type: String, default: null },
  },
  { timestamps: true }
)

paymentSchema.index({ stripeSessionId: 1 }, { unique: true, partialFilterExpression: { stripeSessionId: { $type: 'string' } } })
paymentSchema.index({ invoiceNumber: 1 }, { unique: true, partialFilterExpression: { invoiceNumber: { $type: 'string' } } })
paymentSchema.index({ status: 1, createdAt: -1 })
paymentSchema.index({ user: 1, createdAt: -1 })

const Payment = mongoose.model('Payment', paymentSchema)

/** Gap-free invoice numbers per year; $inc is atomic, so two payments never get the same number */
const counterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } }, { versionKey: false })
const Counter = mongoose.model('Counter', counterSchema)

export const nextInvoiceNumber = async (date = new Date()) => {
  const year = date.getUTCFullYear()
  const { seq } = await Counter.findOneAndUpdate({ _id: `invoice-${year}` }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after' })
  return `FS-${year}-${String(seq).padStart(6, '0')}`
}

export default Payment
