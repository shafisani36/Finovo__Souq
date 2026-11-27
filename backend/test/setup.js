// Loaded before every test file: safe defaults so unit tests run without a .env file
process.env.NODE_ENV = 'test'
process.env.MONGODB_URI = process.env.TEST_MONGODB_URI ?? 'mongodb://127.0.0.1:27017/finovo_souq_test'
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-that-is-long-enough-1234567890'
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-that-is-long-enough-0987654321'
// A separate Redis database, so tests never touch development sessions
process.env.REDIS_DB ??= '15'
process.env.UPLOAD_DIR ??= 'uploads-test'
// Stripe is never called in tests; webhook events are signed locally with this secret
process.env.STRIPE_SECRET_KEY ??= 'sk_test_dummy'
process.env.STRIPE_WEBHOOK_SECRET ??= 'whsec_test_secret'
