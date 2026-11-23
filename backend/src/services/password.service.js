
import bcrypt from 'bcrypt'

const SALT_ROUNDS = 12

export const hashPassword = async (password) => {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export const comparePassword = async (password, hashedPassword) => {
  return bcrypt.compare(password, hashedPassword)
}


export const validatePassword = (password) => {
  const errors = []

  if (typeof password !== 'string') {
    return {
      isValid: false,
      errors: ['Password must be a string'],
    }
  }

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long')
  }

  if (Buffer.byteLength(password, 'utf8') > 72) {
    errors.push('Password cannot exceed 72 bytes for bcrypt')
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain an uppercase letter')
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain a lowercase letter')
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain a number')
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain a special character')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}
