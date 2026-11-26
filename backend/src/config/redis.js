
import Redis from 'ioredis'
import { env } from './env.js'
import { logger } from '../utils/logger.js'

const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  db: env.REDIS_DB,

  // Keep reconnecting with a growing pause (up to 5 seconds), so a short Redis restart never needs an API restart
  retryStrategy(times) {
    return Math.min(times * 500, 5000)
  },

  maxRetriesPerRequest: 3,
  lazyConnect: true,
})

redis.on('connect', () => {
  logger.info('Redis connected')
})

redis.on('error', (error) => {
  logger.error('Redis error', { error: error.message })
})

export const connectRedis = async () => {
  try {
    await redis.connect()
    await redis.ping()
    logger.info('Redis ready')
  } catch (error) {
    logger.error('Redis connection failed', { error: error.message })
    throw error
  }
}

export default redis
