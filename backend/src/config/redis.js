
import Redis from 'ioredis'
import { env } from './env.js'

const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,

  retryStrategy(times) {
    if (times > 5) {
      console.error('Redis connection failed after 5 attempts.')
      return null
    }

    return Math.min(times * 1000, 5000)
  },

  maxRetriesPerRequest: 3,
  lazyConnect: true,
})

redis.on('connect', () => {
  console.log('Redis connected successfully.')
})

redis.on('error', (error) => {
  console.error('Redis Error:', error.message)
})

export const connectRedis = async () => {
  try {
    await redis.connect()
    await redis.ping()
    console.log('Redis is ready.')
  } catch (error) {
    console.error('Redis connection failed:', error.message)
    throw error
  }
}

export default redis
