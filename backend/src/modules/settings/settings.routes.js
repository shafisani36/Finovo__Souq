import { Router } from 'express'
import asyncHandler from '../../utils/asyncHandler.js'
import ApiResponse from '../../utils/ApiResponse.js'
import ApiError from '../../utils/ApiError.js'
import Setting, { PAGE_SLUGS } from './setting.model.js'
import { getSettings, invalidateSettings, toPublicSettings } from './settings.service.js'
import { paymentsAvailable } from '../../services/stripe.service.js'
import { validateGeneralSettings, validatePage } from './settings.validation.js'

/* ---------- Public ---------- */
const router = Router()

router.get('/settings', asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'public, max-age=60')
  res.json(new ApiResponse(200, toPublicSettings(await getSettings())))
}))

router.get('/pages/:slug', asyncHandler(async (req, res) => {
  if (!PAGE_SLUGS.includes(req.params.slug)) throw ApiError.notFound('Page not found')
  const page = (await getSettings()).pages[req.params.slug]
  res.set('Cache-Control', 'public, max-age=60')
  res.json(new ApiResponse(200, { slug: req.params.slug, ...page }))
}))

export default router

/* ---------- Admin (mounted inside the admin router, so already admin-only) ---------- */
export const adminSettingsRouter = Router()

adminSettingsRouter.get('/', asyncHandler(async (req, res) => {
  const { contact, social, announcement, listings, promotions, pages, updatedAt } = await getSettings()
  res.json(new ApiResponse(200, { contact, social, announcement, listings, promotions: { ...promotions, paymentsConfigured: paymentsAvailable() }, pages, updatedAt }))
}))

adminSettingsRouter.patch('/', asyncHandler(async (req, res) => {
  const data = validateGeneralSettings(req.body)
  // Dotted paths, so saving one section never resets another
  const $set = { updatedBy: req.user.id }
  for (const [section, values] of Object.entries(data)) {
    for (const [key, value] of Object.entries(values)) $set[`${section}.${key}`] = value
  }
  await getSettings()
  await Setting.updateOne({ key: 'site' }, { $set })
  invalidateSettings()
  res.json(new ApiResponse(200, null, 'Settings saved'))
}))

adminSettingsRouter.put('/pages/:slug', asyncHandler(async (req, res) => {
  if (!PAGE_SLUGS.includes(req.params.slug)) throw ApiError.notFound('Page not found')
  const page = { ...validatePage(req.body), updatedAt: new Date() }
  await getSettings()
  await Setting.updateOne({ key: 'site' }, { $set: { [`pages.${req.params.slug}`]: page, updatedBy: req.user.id } })
  invalidateSettings()
  res.json(new ApiResponse(200, page, 'Page saved'))
}))
