import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateGeneralSettings, validatePage } from '../src/modules/settings/settings.validation.js'

const errorsOf = (fn) => {
  try {
    fn()
    return null
  } catch (error) {
    return Object.fromEntries(error.errors.map((e) => [e.field, e.message]))
  }
}

test('accepts valid sections and returns only what was sent', () => {
  const data = validateGeneralSettings({
    contact: { email: ' Help@Souq.com ', phone: '+966 11 234 5678', hours: 'Sun-Thu', city: 'Riyadh' },
    social: { instagram: 'https://www.instagram.com/finovosouq', x: 'https://x.com/finovo' },
    listings: { maxPhotos: '12' },
  })
  assert.equal(data.contact.email, 'help@souq.com')
  assert.equal(data.social.instagram, 'https://www.instagram.com/finovosouq')
  assert.equal(data.social.facebook, '')
  assert.deepEqual(data.listings, { maxPhotos: 12 })
  assert.equal(data.announcement, undefined)
})

test('social links must point at their own network over https', () => {
  const errors = errorsOf(() => validateGeneralSettings({ social: { instagram: 'https://evil.com/instagram.com', facebook: 'http://facebook.com/x', youtube: 'https://m.youtube.com/@souq' } }))
  assert.ok(errors['social.instagram'])
  assert.ok(errors['social.facebook'])
  assert.equal(errors['social.youtube'], undefined)
})

test('announcement rules', () => {
  assert.ok(errorsOf(() => validateGeneralSettings({ announcement: { enabled: true, text: '' } }))['announcement.text'])
  assert.ok(errorsOf(() => validateGeneralSettings({ announcement: { text: 'Hi there', link: 'javascript:alert(1)' } }))['announcement.link'])
  assert.ok(errorsOf(() => validateGeneralSettings({ announcement: { text: 'Hi there', link: '//evil.com' } }))['announcement.link'])
  const ok = validateGeneralSettings({ announcement: { enabled: true, text: 'Eid sale week', link: '/search?category=cars', tone: 'other' } })
  assert.equal(ok.announcement.tone, 'info')
})

test('photo limit and contact checks', () => {
  const errors = errorsOf(() => validateGeneralSettings({ contact: { email: 'nope', phone: 'abc' }, listings: { maxPhotos: 50 } }))
  assert.ok(errors['contact.email'] && errors['contact.phone'] && errors['listings.maxPhotos'])
})

test('page validation', () => {
  assert.ok(errorsOf(() => validatePage({ title: 'Hi', body: 'short' })).title)
  const page = validatePage({ title: 'Terms', body: `${'a'.repeat(60)}\r\nline` })
  assert.equal(page.body.includes('\r'), false)
})

test('ad expiry days', () => {
  assert.deepEqual(validateGeneralSettings({ listings: { expiryDays: 45 } }).listings, { expiryDays: 45 })
  assert.ok(errorsOf(() => validateGeneralSettings({ listings: { expiryDays: 3 } }))['listings.expiryDays'])
})

test('promotion packages need allowed lengths and sensible prices', () => {
  const ok = validateGeneralSettings({ promotions: { enabled: true, packages: [{ days: 7, price: 49 }, { days: 3, price: 25 }] } })
  assert.deepEqual(ok.promotions.packages.map((p) => p.days), [3, 7])
  assert.throws(() => validateGeneralSettings({ promotions: { enabled: true, packages: [{ days: 5, price: 20 }] } }))
  assert.throws(() => validateGeneralSettings({ promotions: { enabled: true, packages: [{ days: 3, price: 2 }] } }))
  assert.throws(() => validateGeneralSettings({ promotions: { enabled: true, packages: [] } }))
  assert.equal(validateGeneralSettings({ promotions: { enabled: false, packages: [] } }).promotions.enabled, false)
})
