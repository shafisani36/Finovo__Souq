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

    const seller = await request.post('/api/v1/auth/register').send({ name: 'Seller One', email: 'seller@test.local', password: PASSWORD, accountType: 'seller' })
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
})
