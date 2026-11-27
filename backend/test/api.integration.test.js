/**
 * End-to-end API checks against a real MongoDB and Redis.
 * Runs only when TEST_MONGODB_URI is set (CI sets it); the test database is wiped first, so never point it at real data.
 */
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'

const enabled = Boolean(process.env.TEST_MONGODB_URI)

describe('API', { skip: !enabled && 'Set TEST_MONGODB_URI to run the integration tests' }, () => {
  let request, mongoose, redis, User, Listing, Category, runExpiryJob
  const PASSWORD = 'Test@12345'
  const tokens = {}
  let cars, electronics, listingId, conversationId

  const as = (who) => ({ Authorization: `Bearer ${tokens[who]}` })
  const login = async (email) => {
    const res = await request.post('/api/v1/auth/login').send({ email, password: PASSWORD })
    return res
  }

  before(async () => {
    if (!/test/i.test(process.env.TEST_MONGODB_URI)) throw new Error('TEST_MONGODB_URI must point at a database whose name contains "test"')
    const supertest = (await import('supertest')).default
    const { default: app } = await import('../src/app.js')
    mongoose = (await import('mongoose')).default
    redis = (await import('../src/config/redis.js')).default
    User = (await import('../src/modules/users/user.model.js')).default
    Listing = (await import('../src/modules/listings/listing.model.js')).default
    Category = (await import('../src/modules/categories/category.model.js')).default
    ;({ runExpiryJob } = await import('../src/modules/listings/listing.expiry.js'))
    const { ensureDefaultCategories } = await import('../src/modules/categories/category.seed.js')
    const { invalidateCategoryTree } = await import('../src/modules/categories/category.tree.js')

    await mongoose.connect(process.env.MONGODB_URI)
    await mongoose.connection.dropDatabase()
    await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).syncIndexes()))
    await redis.connect()
    await redis.flushdb()
    invalidateCategoryTree()
    await ensureDefaultCategories()
    cars = await Category.findOne({ slug: 'cars' }).lean()
    electronics = await Category.findOne({ slug: 'electronics' }).lean()
    request = supertest(app)

    await User.create({ name: 'Test Admin', email: 'admin@test.local', password: PASSWORD, role: 'admin' })
  })

  after(async () => {
    await mongoose?.disconnect()
    await redis?.quit()
    const { rm } = await import('node:fs/promises')
    await rm(process.env.UPLOAD_DIR, { recursive: true, force: true })
  })

  test('health check reports MongoDB and Redis', async () => {
    const res = await request.get('/api/v1/health')
    assert.equal(res.status, 200)
    assert.equal(res.body.database, true)
    assert.equal(res.body.cache, true)
  })

  test('buyers sign in at once; sellers wait for approval', async () => {
    const buyer = await request.post('/api/v1/auth/register').send({ name: 'Buyer One', email: 'buyer@test.local', password: PASSWORD })
    assert.equal(buyer.status, 201)
    assert.ok(buyer.body.data.accessToken)
    tokens.buyer = buyer.body.data.accessToken

    const other = await request.post('/api/v1/auth/register').send({ name: 'Buyer Two', email: 'other@test.local', password: PASSWORD })
    tokens.other = other.body.data.accessToken

    const badPhone = await request.post('/api/v1/auth/register').send({ name: 'Seller One', email: 'seller@test.local', password: PASSWORD, accountType: 'seller', phone: '12345' })
    assert.equal(badPhone.status, 400, 'a phone number must be a Saudi mobile')

    const seller = await request.post('/api/v1/auth/register').send({ name: 'Seller One', email: 'seller@test.local', password: PASSWORD, accountType: 'seller', phone: '+966512345678' })
    assert.equal(seller.status, 201)
    assert.equal(seller.body.data.pendingApproval, true)
    assert.equal(seller.body.data.accessToken, undefined)

    const blocked = await login('seller@test.local')
    assert.equal(blocked.status, 403)

    const wrong = await request.post('/api/v1/auth/login').send({ email: 'seller@test.local', password: 'Wrong@12345' })
    assert.equal(wrong.status, 401, 'a wrong password must not reveal the account state')
  })

  test('an admin approves the seller', async () => {
    tokens.admin = (await login('admin@test.local')).body.data.accessToken
    const pending = await request.get('/api/v1/admin/users?status=pending').set(as('admin'))
    assert.equal(pending.status, 200)
    const seller = pending.body.data.items.find((u) => u.email === 'seller@test.local')
    assert.ok(seller)
    assert.equal(seller.password, undefined)

    const approved = await request.post(`/api/v1/admin/users/${seller.id}/approve`).set(as('admin'))
    assert.equal(approved.status, 200)
    assert.equal(approved.body.data.user.status, 'active')

    const res = await login('seller@test.local')
    assert.equal(res.status, 200)
    tokens.seller = res.body.data.accessToken
  })

  test('only admins reach admin routes', async () => {
    assert.equal((await request.get('/api/v1/admin/users').set(as('buyer'))).status, 403)
    assert.equal((await request.get('/api/v1/admin/users')).status, 401)
  })

  test('ads go only into final categories, and only sellers can post', async () => {
    const ad = {
      listingType: 'sale',
      title: 'Toyota Camry 2021 full option',
      description: 'Single owner, full service history at the agency, no accidents.',
      price: 72000,
      city: 'Riyadh',
      district: 'Al Olaya',
      attributes: { make: 'Toyota', model: 'Camry', year: 2021, mileage: 40000, transmission: 'Automatic', condition: 'Used' },
    }
    const parent = await request.post('/api/v1/listings').set(as('seller')).send({ ...ad, categoryId: electronics._id.toString() })
    assert.equal(parent.status, 400)

    const buyer = await request.post('/api/v1/listings').set(as('buyer')).send({ ...ad, categoryId: cars._id.toString() })
    assert.equal(buyer.status, 403)

    const created = await request.post('/api/v1/listings').set(as('seller')).send({ ...ad, categoryId: cars._id.toString() })
    assert.equal(created.status, 201)
    assert.equal(created.body.data.status, 'draft')
    assert.deepEqual(created.body.data.categoryTrail.map((c) => c.slug), ['vehicles', 'cars'])
    listingId = created.body.data.id

    const noPhoto = await request.post(`/api/v1/listings/${listingId}/submit`).set(as('seller'))
    assert.equal(noPhoto.status, 400)

    // Photo uploads are covered by sharp; here a stored photo is enough
    await Listing.updateOne({ _id: listingId }, { $push: { photos: { key: 'public/listings/test.webp', width: 800, height: 600 } } })
    const submitted = await request.post(`/api/v1/listings/${listingId}/submit`).set(as('seller'))
    assert.equal(submitted.status, 200)
    assert.equal(submitted.body.data.status, 'pending_review')
  })

  test('ads in review are private until approved', async () => {
    assert.equal((await request.get(`/api/v1/listings/${listingId}`)).status, 404)
    const approved = await request.post(`/api/v1/admin/listings/${listingId}/approve`).set(as('admin'))
    assert.equal(approved.status, 200)
    assert.equal(approved.body.data.status, 'published')
    assert.ok(approved.body.data.expiresAt)

    const history = await request.get('/api/v1/admin/history').set(as('admin'))
    assert.equal(history.body.data.items[0].action, 'listing_approved')
  })

  test('search covers the whole branch and category filters', async () => {
    const byParent = await request.get('/api/v1/search/listings?category=vehicles')
    assert.equal(byParent.body.data.total, 1)
    assert.equal((await request.get('/api/v1/search/listings?category=cars&f_make=Toyota&f_year_min=2020')).body.data.total, 1)
    assert.equal((await request.get('/api/v1/search/listings?category=cars&f_make=Honda')).body.data.total, 0)
    assert.equal((await request.get('/api/v1/search/listings?category=property')).body.data.total, 0)
    const seller = byParent.body.data.items[0].seller
    assert.equal(seller.email, undefined)
    assert.equal(seller.phone, undefined)
  })

  test('chat is private to its two participants', async () => {
    const started = await request.post('/api/v1/conversations').set(as('buyer')).send({ listingId })
    assert.equal(started.status, 200)
    conversationId = started.body.data.id

    const sent = await request.post(`/api/v1/conversations/${conversationId}/messages`).set(as('buyer')).send({ body: 'Is it still available?' })
    assert.equal(sent.status, 201)

    const sellerView = await request.get(`/api/v1/conversations/${conversationId}/messages`).set(as('seller'))
    assert.equal(sellerView.status, 200)
    assert.equal(sellerView.body.data.items[0].body, 'Is it still available?')

    assert.equal((await request.get(`/api/v1/conversations/${conversationId}/messages`).set(as('other'))).status, 404)
    assert.equal((await request.post('/api/v1/conversations').set(as('seller')).send({ listingId })).status, 409)
  })

  test('ads expire and can be renewed', async () => {
    const early = await request.post(`/api/v1/listings/${listingId}/renew`).set(as('seller'))
    assert.equal(early.status, 409)

    await Listing.updateOne({ _id: listingId }, { $set: { expiresAt: new Date(Date.now() - 1000) } })
    await runExpiryJob()
    assert.equal((await Listing.findById(listingId).lean()).status, 'expired')
    assert.equal((await request.get('/api/v1/search/listings?category=cars')).body.data.total, 0)

    const renewed = await request.post(`/api/v1/listings/${listingId}/renew`).set(as('seller'))
    assert.equal(renewed.status, 200)
    assert.equal(renewed.body.data.status, 'published')
    assert.ok(new Date(renewed.body.data.expiresAt) > new Date())
  })

  test('saved-search alerts reach matching searches', async () => {
    const saved = await request.post('/api/v1/users/me/saved-searches').set(as('other')).send({ label: 'Toyotas in Riyadh', criteria: { category: 'cars', city: 'Riyadh', f_make: 'Toyota' } })
    assert.equal(saved.status, 201)

    const { alertSavedSearches } = await import('../src/modules/alerts/alerts.service.js')
    await alertSavedSearches((await Listing.findById(listingId).lean()))
    const notifications = await request.get('/api/v1/notifications').set(as('other'))
    assert.ok(JSON.stringify(notifications.body.data).includes('saved_search_match'))
  })

  test('settings: public read, admin-only write, safe links only', async () => {
    const pub = await request.get('/api/v1/settings')
    assert.equal(pub.status, 200)
    assert.ok(pub.body.data.listings.maxPhotos)
    assert.equal((await request.patch('/api/v1/admin/settings').set(as('buyer')).send({ listings: { maxPhotos: 5 } })).status, 403)
    const bad = await request.patch('/api/v1/admin/settings').set(as('admin')).send({ announcement: { enabled: true, text: 'Hello', link: 'javascript:alert(1)' } })
    assert.equal(bad.status, 400)
    assert.equal((await request.get('/api/v1/pages/terms')).status, 200)
    assert.equal((await request.get('/api/v1/pages/unknown')).status, 404)
  })

  /* ---------- Security ---------- */

  test('admins can feature a live ad; members cannot', async () => {
    assert.equal((await request.post(`/api/v1/admin/listings/${listingId}/feature`).set(as('buyer')).send({ days: 7 })).status, 403)
    assert.equal((await request.post(`/api/v1/admin/listings/${listingId}/feature`).set(as('admin')).send({ days: 5 })).status, 400)
    const featured = await request.post(`/api/v1/admin/listings/${listingId}/feature`).set(as('admin')).send({ days: 7 })
    assert.equal(featured.status, 200)
    assert.ok(featured.body.data.featuredUntil)
    assert.equal((await request.get('/api/v1/search/listings?featured=true')).body.data.total, 1)
    assert.equal((await request.delete(`/api/v1/admin/listings/${listingId}/feature`).set(as('admin'))).status, 200)
    assert.equal((await request.get('/api/v1/search/listings?featured=true')).body.data.total, 0)
  })

  test('a seller cannot change another seller\'s ad', async () => {
    await User.create({ name: 'Seller Two', email: 'seller2@test.local', password: PASSWORD, accountType: 'seller' })
    tokens.seller2 = (await login('seller2@test.local')).body.data.accessToken
    assert.equal((await request.patch('/api/v1/users/me').set(as('seller2')).send({ phone: '0500' })).status, 400)
    assert.equal((await request.patch(`/api/v1/listings/${listingId}`).set(as('seller2')).send({ price: 1 })).status, 404)
    assert.equal((await request.post(`/api/v1/listings/${listingId}/withdraw`).set(as('seller2'))).status, 404)
    assert.equal((await Listing.findById(listingId).lean()).price, 72000)
  })

  test('uploads that are not real images are refused', async () => {
    const fake = await request.post(`/api/v1/listings/${listingId}/photos`).set(as('seller'))
      .attach('photos', Buffer.from('<?php echo "not an image"; ?>'), { filename: 'photo.jpg', contentType: 'image/jpeg' })
    assert.equal(fake.status, 400)

    const sharp = (await import('sharp')).default
    const png = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#6c47ff' } }).png().toBuffer()
    const real = await request.post(`/api/v1/listings/${listingId}/photos`).set(as('seller'))
      .attach('photos', png, { filename: 'photo.png', contentType: 'image/png' })
    assert.equal(real.status, 201)
    assert.match(real.body.data.photos.at(-1).url, /\.webp$/)
  })

  test('a suspended account is signed out at once', async () => {
    const users = await request.get('/api/v1/admin/users?q=other@test.local').set(as('admin'))
    const other = users.body.data.items[0]
    const suspended = await request.patch(`/api/v1/admin/users/${other.id}/status`).set(as('admin')).send({ status: 'suspended', reason: 'Spam messages' })
    assert.equal(suspended.status, 200)
    assert.equal((await request.get('/api/v1/users/me').set(as('other'))).status, 401)
    assert.equal((await login('other@test.local')).status, 403)
  })

  test('a deletion request can be cancelled, and an admin deletion erases the account', async () => {
    const requested = await request.post('/api/v1/users/me/deletion-request').set(as('buyer')).send({ reason: 'Moving abroad' })
    assert.equal(requested.status, 200)
    assert.equal((await request.delete('/api/v1/users/me/deletion-request').set(as('buyer'))).status, 200)
    assert.equal((await User.findOne({ email: 'buyer@test.local' }).lean()).deletionRequestedAt, null)

    await request.post('/api/v1/users/me/deletion-request').set(as('buyer')).send({ reason: 'Moving abroad' })
    const queue = await request.get('/api/v1/admin/users?deletion=requested').set(as('admin'))
    const buyer = queue.body.data.items.find((u) => u.email === 'buyer@test.local')
    assert.equal(buyer.deletionReason, 'Moving abroad')

    assert.equal((await request.post(`/api/v1/admin/users/${buyer.id}/delete`).set(as('admin')).send({ reason: 'x' })).status, 400)
    const deleted = await request.post(`/api/v1/admin/users/${buyer.id}/delete`).set(as('admin')).send({ reason: 'User asked for deletion' })
    assert.equal(deleted.status, 200)
    assert.equal(deleted.body.data.status, 'deleted')
    assert.equal(deleted.body.data.name, 'Deleted user')
    assert.notEqual(deleted.body.data.email, 'buyer@test.local')

    assert.equal((await request.get('/api/v1/users/me').set(as('buyer'))).status, 401)
    assert.equal((await login('buyer@test.local')).status, 401)
    const thread = await request.get(`/api/v1/conversations/${conversationId}/messages`).set(as('seller'))
    assert.ok(thread.body.data.items.every((m) => m.sender !== buyer.id || m.body === ''))
    assert.equal((await request.post(`/api/v1/admin/users/${buyer.id}/delete`).set(as('admin')).send({ reason: 'Again please' })).status, 409)
  })

  test('a paid Stripe checkout waits for an admin, then features the ad once', async () => {
    const Payment = (await import('../src/modules/payments/payment.model.js')).default
    const { stripe } = await import('../src/services/stripe.service.js')
    const seller = await User.findOne({ email: 'seller@test.local' })
    const payment = await Payment.create({ user: seller._id, listing: listingId, days: 7, amount: 4900, stripeSessionId: 'cs_test_paid' })

    const event = (type, object) => JSON.stringify({ id: `evt_${type}`, object: 'event', type, data: { object } })
    const send = (payload, secret = process.env.STRIPE_WEBHOOK_SECRET) => request.post('/api/v1/payments/stripe/webhook')
      .set('content-type', 'application/json')
      .set('stripe-signature', stripe().webhooks.generateTestHeaderString({ payload, secret }))
      .send(payload)

    const paid = event('checkout.session.completed', { id: 'cs_test_paid', object: 'checkout.session', payment_status: 'paid', amount_total: 4900, currency: 'sar', payment_intent: 'pi_test' })
    assert.equal((await send(paid, 'whsec_wrong')).status, 400, 'unsigned events are refused')
    assert.equal((await send(paid)).status, 200)
    assert.equal((await send(paid)).status, 200, 'a repeated event is accepted and ignored')

    const recorded = await Payment.findById(payment._id).lean()
    assert.equal(recorded.status, 'paid')
    assert.match(recorded.invoiceNumber, /^FS-\d{4}-000001$/)
    assert.equal((await Listing.findById(listingId).lean()).featuredUntil, null, 'nothing is featured before an admin approves')

    const queue = await request.get('/api/v1/admin/payments?status=paid').set(as('admin'))
    assert.equal(queue.body.data.items.length, 1)
    assert.equal(queue.body.data.items[0].amount, 49)

    assert.equal((await request.post(`/api/v1/admin/payments/${payment.id}/approve`).set(as('seller'))).status, 403)
    // The photo upload above sent the ad back for review, so it is not live yet
    assert.equal((await request.post(`/api/v1/admin/payments/${payment.id}/approve`).set(as('admin'))).status, 409, 'an ad that is not live is not featured')
    assert.equal((await Payment.findById(payment._id).lean()).status, 'paid', 'the payment stays in the queue to approve or refund')
    assert.equal((await request.post(`/api/v1/admin/listings/${listingId}/approve`).set(as('admin'))).status, 200)
    const approved = await request.post(`/api/v1/admin/payments/${payment.id}/approve`).set(as('admin'))
    assert.equal(approved.status, 200)
    assert.equal(approved.body.data.status, 'approved')
    const featuredUntil = (await Listing.findById(listingId).lean()).featuredUntil
    assert.ok(featuredUntil > new Date(Date.now() + 6.9 * 864e5))
    assert.equal((await request.post(`/api/v1/admin/payments/${payment.id}/approve`).set(as('admin'))).status, 409, 'a payment is approved once')
    assert.equal((await request.post(`/api/v1/admin/payments/${payment.id}/reject`).set(as('admin')).send({ reason: 'Too late now' })).status, 409)

    const other = await request.post('/api/v1/payments/promotions').set(as('seller2')).send({ listingId, days: 7 })
    assert.equal(other.status, 409, 'sellers can only promote their own ads')
    assert.equal((await request.post('/api/v1/payments/promotions').set(as('seller')).send({ listingId, days: 5 })).status, 400)
  })

  test('a business store goes public only after an admin checks its registration', async () => {
    assert.equal((await request.post('/api/v1/stores/mine').set(as('seller')).send({ name: 'Riyadh Motors', commercialRegistration: '12345' })).status, 400)
    const created = await request.post('/api/v1/stores/mine').set(as('seller')).send({ name: 'Riyadh Motors', city: 'Riyadh', commercialRegistration: '1010123456' })
    assert.equal(created.status, 201)
    assert.equal(created.body.data.status, 'pending')
    assert.equal((await request.post('/api/v1/stores/mine').set(as('seller')).send({ name: 'Second', commercialRegistration: '1010123457' })).status, 409, 'one store per seller')

    const slug = created.body.data.slug
    assert.equal((await request.get(`/api/v1/stores/${slug}`)).status, 404, 'pending stores are private')
    assert.equal((await request.post(`/api/v1/admin/stores/${created.body.data.id}/verify`).set(as('seller'))).status, 403)
    assert.equal((await request.post(`/api/v1/admin/stores/${created.body.data.id}/verify`).set(as('admin'))).status, 200)

    const page = await request.get(`/api/v1/stores/${slug}`)
    assert.equal(page.status, 200)
    assert.equal(page.body.data.commercialRegistration, undefined, 'the CR number stays private')
    const seller = await User.findOne({ email: 'seller@test.local' })
    const profile = await request.get(`/api/v1/sellers/${seller.id}`)
    assert.equal(profile.body.data.trust.business.slug, slug)

    const renamed = await request.patch('/api/v1/stores/mine').set(as('seller')).send({ name: 'Riyadh Motors Co' })
    assert.equal(renamed.body.data.status, 'pending', 'a new name is checked again')
  })
})
