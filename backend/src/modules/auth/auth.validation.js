
import { validatePassword } from '../../services/password.service.js'

export const validateRegister = (data) => {
  const errors = []

  const { name, email, password, phone } = data

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

  if (
    phone !== undefined &&
    phone !== null &&
    typeof phone !== 'string'
  ) {
    errors.push('Phone must be a string')
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