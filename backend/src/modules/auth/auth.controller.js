
import asyncHandler from '../../utils/asyncHandler.js'
import ApiResponse from '../../utils/ApiResponse.js'
import ApiError from '../../utils/ApiError.js'

import {
  registerUser,
  loginUser,
  logoutUser,
  logoutAllDevices,
    refreshUserTokens,
} from './auth.service.js'

import { requestPasswordReset, resetPassword, verifyResetCode } from './passwordReset.service.js'

import {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetCode,
  validateResetPassword,
} from './auth.validation.js'

const setRefreshCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/v1/auth',
  })
}

export const register = asyncHandler(async (req, res) => {
  const validation = validateRegister(req.body)

  if (!validation.isValid) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: validation.errors,
    })
  }

  const result = await registerUser(req.body, req)

  if (result.pendingApproval) {
    return res.status(201).json(
      new ApiResponse(201, { user: result.user, pendingApproval: true }, 'Account created. It will be active once an admin approves it.')
    )
  }

  setRefreshCookie(res, result.refreshToken)

  res.status(201).json(
    new ApiResponse(201, {
      user: result.user,
      accessToken: result.accessToken,
      sessionId: result.sessionId,
    }, 'Registration successful')
  )
})

export const login = asyncHandler(async (req, res) => {
  const validation = validateLogin(req.body)

  if (!validation.isValid) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: validation.errors,
    })
  }

  const result = await loginUser(req.body, req)

  setRefreshCookie(res, result.refreshToken)

  res.status(200).json(
    new ApiResponse(200, {
      user: result.user,
      accessToken: result.accessToken,
      sessionId: result.sessionId,
    }, 'Login successful')
  )
})

export const logout = asyncHandler(async (req, res) => {
  await logoutUser(req.body.sessionId, req.user.id)

  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/v1/auth',
  })

  res.status(200).json(
    new ApiResponse(200, null, 'Logout successful')
  )
})

export const logoutAll = asyncHandler(async (req, res) => {
  await logoutAllDevices(req.user.id)

  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/v1/auth',
  })

  res.status(200).json(
    new ApiResponse(200, null, 'All devices logged out successfully')
  )
})


export const testAuth = asyncHandler(async (req, res) => {
  res.status(200).json(
    new ApiResponse(200, {
      user: req.user,
    }, 'Authentication successful')
  )
})


export const refresh = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies.refreshToken

  const result = await refreshUserTokens(refreshToken)

  setRefreshCookie(res, result.refreshToken)

  res.status(200).json(
    new ApiResponse(200, {
      user: result.user,
      accessToken: result.accessToken,
    }, 'Token refreshed successfully')
  )
})

export const forgotPassword = asyncHandler(async (req, res) => {
  const errors = validateForgotPassword(req.body)
  if (Object.keys(errors).length) throw ApiError.validation(errors)

  await requestPasswordReset(req.body.email.toLowerCase().trim())

  res.status(200).json(
    new ApiResponse(200, null, 'If an account exists for this email, a reset code has been sent')
  )
})

export const verifyPasswordResetCode = asyncHandler(async (req, res) => {
  const errors = validateResetCode(req.body)
  if (Object.keys(errors).length) throw ApiError.validation(errors)

  const resetToken = await verifyResetCode(req.body.email.toLowerCase().trim(), req.body.otp)

  res.status(200).json(
    new ApiResponse(200, { resetToken }, 'Code verified')
  )
})

export const resetPasswordWithToken = asyncHandler(async (req, res) => {
  const errors = validateResetPassword(req.body)
  if (Object.keys(errors).length) throw ApiError.validation(errors)

  await resetPassword({
    email: req.body.email.toLowerCase().trim(),
    resetToken: req.body.resetToken,
    password: req.body.password,
  })

  res.status(200).json(
    new ApiResponse(200, null, 'Your password has been changed. Please sign in.')
  )
})
