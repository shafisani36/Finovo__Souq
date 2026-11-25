import nodemailer from 'nodemailer'

import { env } from '../config/env.js'
import ApiError from '../utils/ApiError.js'

const transporter = env.MAIL_HOST
  ? nodemailer.createTransport({
      host: env.MAIL_HOST,
      port: env.MAIL_PORT,
      secure: env.MAIL_PORT === 465,
      requireTLS: env.MAIL_PORT !== 465,
      auth: { user: env.MAIL_USERNAME, pass: env.MAIL_PASSWORD },
    })
  : null

export const sendMail = async ({ to, subject, text, html }) => {
  if (!transporter) throw new ApiError(503, 'Email is not set up on the server yet')

  try {
    await transporter.sendMail({ from: { name: env.MAIL_FROM_NAME, address: env.MAIL_FROM_ADDRESS }, to, subject, text, html })
  } catch (error) {
    console.error('Email send failed:', error.message)
    throw new ApiError(503, 'We could not send the email. Please try again in a few minutes.')
  }
}
