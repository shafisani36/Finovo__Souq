
import { validatePassword } from '../../services/password.service.js'

export const validateRegister = (data) => {
  const errors = []

  const { name, email, password, phone, accountType } = data

  if (accountType !== undefined && !['buyer', 'seller'].includes(accountType)) {
    errors.push('Choose a buyer or seller account')
  }

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push('Name must contain at least 2 characters')
  }

  if (typeof name === 'string' && name.trim().length > 60) {
    errors.push('Name cannot exceed 60 characters')
  }

  if (
    !email ||
    typeof email !== 'string' ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    errors.push('Please provide a valid email address')
  }

  if (password === undefined || password === null) {
    errors.push('Password is required')
  } else {
    const passwordResult = validatePassword(password)
    errors.push(...passwordResult.errors)
  }

  // Optional; when given it must be a Saudi mobile, the same rule as the profile form
  if (phone !== undefined && phone !== null && phone !== '' && (typeof phone !== 'string' || !/^\+9665\d{8}$/.test(phone))) {
    errors.push({ field: 'phone', message: 'Enter a Saudi mobile number like +9665XXXXXXXX' })
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

export const validateLogin = (data) => {
  const errors = []

  if (
    !data.email ||
    typeof data.email !== 'string' ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)
  ) {
    errors.push('Please provide a valid email address')
  }

  if (
    !data.password ||
    typeof data.password !== 'string'
  ) {
    errors.push('Password is required')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}
const isEmail = (value) => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

export const validateForgotPassword = (data) => {
  const errors = {}
  if (!isEmail(data.email)) errors.email = 'Please provide a valid email address'
  return errors
}

export const validateResetCode = (data) => {
  const errors = validateForgotPassword(data)
  if (typeof data.otp !== 'string' || !/^\d{6}$/.test(data.otp)) errors.otp = 'Enter the 6-digit code from the email'
  return errors
}

export const validateResetPassword = (data) => {
  const errors = validateForgotPassword(data)
  if (typeof data.resetToken !== 'string' || !/^[a-f0-9]{64}$/.test(data.resetToken)) errors.resetToken = 'Reset session is missing'
  const passwordResult = validatePassword(data.password)
  if (!passwordResult.isValid) errors.password = passwordResult.errors[0]
  return errors
}
