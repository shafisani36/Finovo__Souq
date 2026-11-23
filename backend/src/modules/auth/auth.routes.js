import { Router } from 'express'

import {
  register,
  login,
  logout,
  logoutAll,
  testAuth,
  refresh,
} from './auth.controller.js'

import authenticate from '../../middleware/authenticate.js'
import { authLimiter } from '../../middleware/rateLimiter.js'

const router = Router()

router.post('/register', authLimiter, register)
router.post('/login', authLimiter, login)
router.post('/refresh', authLimiter, refresh)

router.post('/logout', authenticate, logout)
router.post('/logout-all', authenticate, logoutAll)

router.get('/me', authenticate, testAuth)



export default router
