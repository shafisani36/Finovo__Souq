import http from 'node:http'
import mongoose from 'mongoose'
import app from './app.js'
import { env } from './config/env.js'
import connectDB from './config/database.js'
import redis, { connectRedis } from './config/redis.js'
import { initSocket } from './realtime/socket.js'
import { ensureDefaultCategories } from './modules/categories/category.seed.js'
import { startJobs } from './jobs/scheduler.js'
import { errorFields, logger } from './utils/logger.js'

const SHUTDOWN_TIMEOUT_MS = 10_000

const startServer = async () => {
  try {
    await connectDB()
    await connectRedis()
    await ensureDefaultCategories()

    const server = http.createServer(app)
    const io = initSocket(server)
    const stopJobs = startJobs()

    server.listen(env.PORT, () => {
      logger.info('API started', { port: env.PORT, environment: env.NODE_ENV })
    })

    // On a deploy or restart: stop taking requests, let running ones finish, then close the connections
    const shutdown = (signal) => {
      logger.info('shutting down', { signal })
      stopJobs()
      setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref()
      io.close()
      server.close(async () => {
        await Promise.allSettled([mongoose.disconnect(), redis.quit()])
        process.exit(0)
      })
    }
    process.once('SIGTERM', () => shutdown('SIGTERM'))
    process.once('SIGINT', () => shutdown('SIGINT'))
  } catch (error) {
    logger.error('startup failed', errorFields(error))
    process.exit(1)
  }
}

process.on('unhandledRejection', (reason) => {
  logger.error('unhandled promise rejection', errorFields(reason))
})

startServer()
