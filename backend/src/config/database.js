
import mongoose from 'mongoose'
import { env } from './env.js'
import { logger } from '../utils/logger.js'

const connectDB = async () => {
  try {
    const connection = await mongoose.connect(env.MONGODB_URI)

    logger.info('MongoDB connected', { host: connection.connection.host })
  } catch (error) {
    logger.error('MongoDB connection failed', { error: error.message })
    process.exit(1)
  }
}

export default connectDB
