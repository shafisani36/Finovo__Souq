
import dotenv from 'dotenv'

dotenv.config()

const requiredEnv = [
  'MONGODB_URI',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
]

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
}

// In production weak or default values are refused, so a misconfigured server never starts
if (process.env.NODE_ENV === 'production') {
  for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
    if (process.env[key].length < 32) throw new Error(`${key} must be at least 32 characters in production`)
  }
  if (process.env.JWT_ACCESS_SECRET === process.env.JWT_REFRESH_SECRET) throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different')
  if (!process.env.CLIENT_URL?.startsWith('https://')) throw new Error('CLIENT_URL must be the https address of the website in production')
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT) || 5000,

  MONGODB_URI: process.env.MONGODB_URI,

  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,

  ACCESS_TOKEN_EXPIRES: process.env.ACCESS_TOKEN_EXPIRES || '15m',
  REFRESH_TOKEN_EXPIRES: process.env.REFRESH_TOKEN_EXPIRES || '7d',

  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  TRUST_PROXY: Number(process.env.TRUST_PROXY ?? 1),

  REDIS_HOST: process.env.REDIS_HOST || '127.0.0.1',
  REDIS_PORT: Number(process.env.REDIS_PORT) || 6379,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || '',
  REDIS_DB: Number(process.env.REDIS_DB) || 0,

  // Uploaded photos and voice messages; keep this folder out of the web root and back it up
  UPLOAD_DIR: process.env.UPLOAD_DIR || 'uploads',

  // SMTP for password reset codes (same names as the Laravel .env, so the block can be pasted as is)
  MAIL_HOST: process.env.MAIL_HOST || '',
  MAIL_PORT: Number(process.env.MAIL_PORT) || 587,
  MAIL_USERNAME: process.env.MAIL_USERNAME || '',
  MAIL_PASSWORD: process.env.MAIL_PASSWORD || '',
  MAIL_FROM_ADDRESS: process.env.MAIL_FROM_ADDRESS || process.env.MAIL_USERNAME || '',
  MAIL_FROM_NAME: process.env.MAIL_FROM_NAME || 'Finovo Souq',
}