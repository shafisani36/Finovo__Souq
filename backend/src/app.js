
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'

import { env } from './config/env.js'
import errorHandler from './middleware/errorHandler.js'
import authRoutes from './modules/auth/auth.routes.js'

const app = express()

app.use(cors({
  origin: env.CLIENT_URL,
  credentials: true,
}))

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

// Health check
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Finovo Souq API is running',
  })
})

// API routes
app.use('/api/v1/auth', authRoutes)

// Global error handler (must be last)
app.use(errorHandler)

export default app