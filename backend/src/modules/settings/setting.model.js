import mongoose from 'mongoose'

export const PAGE_SLUGS = ['help', 'safety', 'terms', 'privacy']
export const SOCIAL_NETWORKS = ['x', 'instagram', 'facebook', 'tiktok', 'youtube']

const pageSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    // Light formatting only: "## " headings, "- " list items and **bold**
    body: { type: String, required: true },
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
    pages: Object.fromEntries(PAGE_SLUGS.map((slug) => [slug, { type: pageSchema }])),
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, minimize: false }
)

const Setting = mongoose.model('Setting', settingSchema)

export default Setting
