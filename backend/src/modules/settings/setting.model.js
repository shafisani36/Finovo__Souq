import mongoose from 'mongoose'

export const PAGE_SLUGS = ['help', 'safety', 'terms', 'privacy']
export const SOCIAL_NETWORKS = ['x', 'instagram', 'facebook', 'tiktok', 'youtube']

const pageSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    // Light formatting only: "## " headings, "- " list items and **bold**
    body: { type: String, required: true },
    // Arabic version for the Arabic site; when empty the English page is shown
    titleAr: { type: String, default: '' },
    bodyAr: { type: String, default: '' },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
)

/** One document holds every site-wide setting an admin can change without a deploy */
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'site' },
    contact: {
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
      hours: { type: String, default: '' },
      city: { type: String, default: '' },
    },
    social: Object.fromEntries(SOCIAL_NETWORKS.map((network) => [network, { type: String, default: '' }])),
    announcement: {
      enabled: { type: Boolean, default: false },
      text: { type: String, default: '' },
      tone: { type: String, enum: ['info', 'warning'], default: 'info' },
      link: { type: String, default: '' },
    },
    listings: {
      maxPhotos: { type: Number, default: 10, min: 1, max: 20 },
      expiryDays: { type: Number, default: 30, min: 7, max: 180 },
    },
    // Prices sellers pay to feature an ad, in whole riyals
    promotions: {
      enabled: { type: Boolean, default: true },
      packages: {
        type: [new mongoose.Schema({ days: { type: Number, required: true }, price: { type: Number, required: true } }, { _id: false })],
        default: undefined,
      },
    },
    pages: Object.fromEntries(PAGE_SLUGS.map((slug) => [slug, { type: pageSchema }])),
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, minimize: false }
)

const Setting = mongoose.model('Setting', settingSchema)

export default Setting
