import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { env } from '../config/env.js'
import ApiError from '../utils/ApiError.js'

const ROOT = path.resolve(env.UPLOAD_DIR)
export const FILES_ROUTE = '/api/v1/files'
const SIGNED_URL_TTL_SECONDS = 60 * 60

// Separate key, so a leaked media link can never be used to forge login tokens
const signingKey = crypto.createHash('sha256').update(`media-url:${env.JWT_ACCESS_SECRET}`).digest()

const IMAGE_PRESETS = {
  listing: { width: 1600, height: 1600, fit: 'inside' },
  avatar: { width: 400, height: 400, fit: 'cover' },
  chat: { width: 1600, height: 1600, fit: 'inside' },
}

// Audio formats browsers record (Chrome/Firefox: webm or ogg, Safari: mp4)
const AUDIO_SIGNATURES = [
  { ext: 'webm', mime: 'audio/webm', test: (b) => b.readUInt32BE(0) === 0x1a45dfa3 },
  { ext: 'ogg', mime: 'audio/ogg', test: (b) => b.toString('ascii', 0, 4) === 'OggS' },
  { ext: 'm4a', mime: 'audio/mp4', test: (b) => b.toString('ascii', 4, 8) === 'ftyp' },
]

const write = async (key, buffer) => {
  const filePath = path.join(ROOT, key)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, buffer, { flag: 'wx' })
}

const newKey = (folder, ext) => `${folder}/${crypto.randomUUID()}.${ext}`

/**
 * Re-encodes an upload as WebP. Decoding proves it is a real image, and re-encoding drops
 * EXIF data such as the GPS location where the photo was taken.
 */
export const saveImage = async (buffer, folder, preset) => {
  let output
  try {
    output = await sharp(buffer, { failOn: 'error', limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ ...IMAGE_PRESETS[preset], withoutEnlargement: preset !== 'avatar' })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true })
  } catch {
    throw new ApiError(400, 'Upload a JPG, PNG or WebP image')
  }
  const key = newKey(folder, 'webp')
  await write(key, output.data)
  return { key, mime: 'image/webp', size: output.info.size, width: output.info.width, height: output.info.height }
}

/** Stores a voice recording after checking its real format from the file header */
export const saveAudio = async (buffer, folder) => {
  const format = buffer.length > 12 && AUDIO_SIGNATURES.find((s) => s.test(buffer))
  if (!format) throw new ApiError(400, 'Unsupported audio format')
  const key = newKey(folder, format.ext)
  await write(key, buffer)
  return { key, mime: format.mime, size: buffer.length }
}

export const removeFile = async (key) => {
  if (!key) return
  await fs.rm(path.join(ROOT, key), { force: true })
}

/** Public files (ad photos, profile photos) are served as static files */
export const publicUrl = (key) => (key ? `${FILES_ROUTE}/${key}` : null)

const sign = (key, expires) => crypto.createHmac('sha256', signingKey).update(`${key}:${expires}`).digest('base64url')

/** Private files (chat photos and voice messages) get a link that stops working after an hour */
export const signedUrl = (key) => {
  const expires = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS
  return `${FILES_ROUTE}/${key}?exp=${expires}&sig=${sign(key, expires)}`
}

/** Returns the absolute path of a private file if the link is valid, otherwise null */
export const resolveSignedFile = (key, expires, signature) => {
  const exp = Number(expires)
  if (!Number.isInteger(exp) || exp < Date.now() / 1000 || typeof signature !== 'string') return null
  const expected = Buffer.from(sign(key, exp))
  const given = Buffer.from(signature)
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null
  const filePath = path.join(ROOT, key)
  return filePath.startsWith(ROOT + path.sep) ? filePath : null
}

export const PUBLIC_DIR = path.join(ROOT, 'public')
