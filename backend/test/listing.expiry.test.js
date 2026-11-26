import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canRenew } from '../src/modules/listings/listing.expiry.js'

const DAY = 24 * 60 * 60 * 1000
const now = Date.now()

test('expired ads can be renewed', () => {
  assert.equal(canRenew({ status: 'expired' }, now), true)
})

test('live ads only in their last three days', () => {
  assert.equal(canRenew({ status: 'published', expiresAt: new Date(now + 2 * DAY) }, now), true)
  assert.equal(canRenew({ status: 'published', expiresAt: new Date(now + 10 * DAY) }, now), false)
  assert.ok(!canRenew({ status: 'published', expiresAt: null }, now))
})

test('other statuses cannot be renewed', () => {
  for (const status of ['draft', 'pending_review', 'withdrawn', 'hidden', 'rejected']) assert.ok(!canRenew({ status, expiresAt: new Date(now) }, now))
})
