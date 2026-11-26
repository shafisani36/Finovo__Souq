import { runExpiryJob } from '../modules/listings/listing.expiry.js'
import { errorFields, logger } from '../utils/logger.js'

// Every 15 minutes, so expired ads and ended promotions leave search quickly
const INTERVAL_MS = 15 * 60 * 1000
const FIRST_RUN_DELAY_MS = 30 * 1000

/** Background work on a timer. Each job takes its own Redis lock, so running several servers is safe */
export const startJobs = () => {
  const run = () => runExpiryJob().catch((error) => logger.error('ad expiry job failed', errorFields(error)))
  const first = setTimeout(run, FIRST_RUN_DELAY_MS)
  const timer = setInterval(run, INTERVAL_MS)
  first.unref()
  timer.unref()
  return () => {
    clearTimeout(first)
    clearInterval(timer)
  }
}
