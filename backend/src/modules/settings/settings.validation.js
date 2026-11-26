import ApiError from '../../utils/ApiError.js'
import { toText } from '../../utils/pagination.js'
import { SOCIAL_NETWORKS } from './setting.model.js'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_PATTERN = /^\+?[0-9 ]{7,20}$/
// Each social link must point at its own network, so the footer cannot be used to send visitors elsewhere
const SOCIAL_HOSTS = {
  x: ['x.com', 'twitter.com'],
  instagram: ['instagram.com'],
  facebook: ['facebook.com'],
  tiktok: ['tiktok.com'],
  youtube: ['youtube.com'],
}

const isNetworkUrl = (value, network) => {
  try {
    const url = new URL(value)
    const host = url.hostname.replace(/^www\./, '')
    return url.protocol === 'https:' && SOCIAL_HOSTS[network].some((h) => host === h || host.endsWith(`.${h}`))
  } catch {
    return false
  }
}

// An announcement can link inside the site ("/safety") or to any https page
const isSafeLink = (value) => {
  if (/^\/(?!\/)[\w\-./?=&#%]*$/.test(value)) return true
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

/** Validates the general settings form; only the sections that were sent are returned */
export const validateGeneralSettings = (body) => {
  const errors = {}
  const data = {}

  if (body.contact) {
    const contact = {
      email: toText(body.contact.email).toLowerCase(),
      phone: toText(body.contact.phone),
      hours: toText(body.contact.hours),
      city: toText(body.contact.city),
    }
    if (!EMAIL_PATTERN.test(contact.email)) errors['contact.email'] = 'Enter a valid support email'
    if (contact.phone && !PHONE_PATTERN.test(contact.phone)) errors['contact.phone'] = 'Use digits, spaces and an optional + only'
    if (contact.hours.length > 80) errors['contact.hours'] = 'Keep it under 80 characters'
    if (contact.city.length > 60) errors['contact.city'] = 'Keep it under 60 characters'
    data.contact = contact
  }

  if (body.social) {
    data.social = {}
    for (const network of SOCIAL_NETWORKS) {
      const value = toText(body.social[network])
      if (value && !isNetworkUrl(value, network)) errors[`social.${network}`] = `Paste the full https link of your ${network === 'x' ? 'X' : network} page`
      data.social[network] = value
    }
  }

  if (body.announcement) {
    const announcement = {
      enabled: body.announcement.enabled === true,
      text: toText(body.announcement.text),
      tone: body.announcement.tone === 'warning' ? 'warning' : 'info',
      link: toText(body.announcement.link),
    }
    if (announcement.text.length > 200) errors['announcement.text'] = 'Keep the announcement under 200 characters'
    if (announcement.enabled && announcement.text.length < 5) errors['announcement.text'] = 'Write the announcement before turning it on'
    if (announcement.link && !isSafeLink(announcement.link)) errors['announcement.link'] = 'Use a page on this site such as /safety, or a full https link'
    data.announcement = announcement
  }

  if (body.listings) {
    const limits = { maxPhotos: [1, 20, 'Choose between 1 and 20 photos'], expiryDays: [7, 180, 'Choose between 7 and 180 days'] }
    data.listings = {}
    for (const [key, [min, max, message]] of Object.entries(limits)) {
      if (body.listings[key] === undefined) continue
      const value = Number(body.listings[key])
      if (!Number.isInteger(value) || value < min || value > max) errors[`listings.${key}`] = message
      data.listings[key] = value
    }
  }

  if (Object.keys(errors).length) throw ApiError.validation(errors)
  return data
}

export const validatePage = (body) => {
  const title = toText(body.title)
  const content = typeof body.body === 'string' ? body.body.replace(/\r\n/g, '\n').trim() : ''
  const errors = {}
  if (title.length < 3 || title.length > 80) errors.title = 'Title must be 3 to 80 characters'
  if (content.length < 50 || content.length > 20000) errors.body = 'Content must be 50 to 20,000 characters'
  if (Object.keys(errors).length) throw ApiError.validation(errors)
  return { title, body: content }
}
