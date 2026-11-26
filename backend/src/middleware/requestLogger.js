import { randomUUID } from 'node:crypto'
import { logger } from '../utils/logger.js'

const REQUEST_ID = /^[\w-]{8,64}$/
const QUIET_PATHS = new Set(['/api/v1/health'])

/**
 * Gives every request an id (kept from a trusted proxy if it sent one) and logs one line when it ends.
 * Only the path is logged, never the query string, which can hold search text or signed file links.
 */
const requestLogger = (req, res, next) => {
  const incoming = req.get('x-request-id')
  req.id = incoming && REQUEST_ID.test(incoming) ? incoming : randomUUID()
  res.setHeader('X-Request-Id', req.id)
  const started = process.hrtime.bigint()

  res.on('finish', () => {
    const path = req.originalUrl.split('?')[0]
    if (QUIET_PATHS.has(path)) return
    const fields = {
      requestId: req.id,
      method: req.method,
      path,
      status: res.statusCode,
      durationMs: Math.round(Number(process.hrtime.bigint() - started) / 1e6),
      ...(req.user?.id && { userId: req.user.id }),
      ip: req.ip,
    }
    if (res.statusCode >= 500) logger.error('request failed', fields)
    else if (res.statusCode >= 400) logger.warn('request rejected', fields)
    else logger.info('request', fields)
  })
  next()
}

export default requestLogger
