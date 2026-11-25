
import http from 'node:http'
import app from './app.js'
import { env } from './config/env.js'
import connectDB from './config/database.js'
import { connectRedis } from './config/redis.js'
import { initSocket } from './realtime/socket.js'

const startServer = async () => {
  try {
    await connectDB()
    await connectRedis()

    const server = http.createServer(app)
    initSocket(server)

    server.listen(env.PORT, () => {
      console.log(`Finovo Souq API running on port ${env.PORT}`)
      console.log(`Environment: ${env.NODE_ENV}`)
    })
  } catch (error) {
    console.error('Server startup failed:', error.message)
    process.exit(1)
  }
}

startServer()
