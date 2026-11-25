import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'

import { env } from './config/env.js'
import errorHandler from './middleware/errorHandler.js'
import { PUBLIC_DIR, resolveSignedFile } from './services/storage.service.js'
import authRoutes from './modules/auth/auth.routes.js'
import userRoutes from './modules/users/users.routes.js'
import savedRoutes from './modules/saved/saved.routes.js'
import categoryRoutes from './modules/categories/categories.routes.js'
import listingRoutes, { searchRouter } from './modules/listings/listings.routes.js'
import reportRoutes from './modules/reports/reports.routes.js'
import chatRoutes from './modules/chat/chat.routes.js'
import notificationRoutes from './modules/notifications/notifications.routes.js'
import adminRoutes from './modules/admin/admin.routes.js'
import dashboardRoutes from './modules/dashboard/dashboard.routes.js'
import supportRoutes from './modules/support/support.routes.js'

const app = express()

// Needed behind a load balancer or reverse proxy, so rate limits see the real client IP
app.set('trust proxy', 1)

app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }))

app.use(cors({
  origin: env.CLIENT_URL,
  credentials: true,
}))

app.use(express.json({ limit: '100kb' }))
app.use(express.urlencoded({ extended: true, limit: '100kb' }))
app.use(cookieParser())

// Health check
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Finovo Souq API is running',
  })
})

// Ad and profile photos are public; file names are random so they cannot be guessed
app.use('/api/v1/files/public', express.static(PUBLIC_DIR, { maxAge: '30d', immutable: true, index: false, dotfiles: 'deny' }))

// Chat photos and voice messages need a valid signed link
app.get('/api/v1/files/private/*path', (req, res) => {
  const filePath = resolveSignedFile(`private/${req.params.path.join('/')}`, req.query.exp, req.query.sig)
  if (!filePath) return res.status(403).json({ success: false, message: 'This link has expired' })
  res.set('Cache-Control', 'private, max-age=3600')
  res.sendFile(filePath, (error) => {
    if (error && !res.headersSent) res.status(404).json({ success: false, message: 'File not found' })
  })
})

// API routes
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/users', userRoutes)
app.use('/api/v1/users/me', savedRoutes)
app.use('/api/v1/categories', categoryRoutes)
app.use('/api/v1/search', searchRouter)
app.use('/api/v1/listings', reportRoutes)
app.use('/api/v1/listings', listingRoutes)
app.use('/api/v1/conversations', chatRoutes)
app.use('/api/v1/notifications', notificationRoutes)
app.use('/api/v1/admin', adminRoutes)
app.use('/api/v1', dashboardRoutes)
app.use('/api/v1/support', supportRoutes)

app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' })
})

// Global error handler (must be last)
app.use(errorHandler)

export default app
