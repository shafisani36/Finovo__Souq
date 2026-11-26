import { env } from '../config/env.js'

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 }
const defaultLevel = env.NODE_ENV === 'test' ? 'silent' : env.NODE_ENV === 'production' ? 'info' : 'debug'
const minLevel = LEVELS[process.env.LOG_LEVEL] ?? LEVELS[defaultLevel]

/**
 * One JSON object per line in production, so log tools can search and alert on any field;
 * readable lines in development. Never pass passwords, tokens, codes or message text in `fields`.
 */
const write = (level, message, fields = {}) => {
  if (LEVELS[level] < minLevel) return
  const out = level === 'error' || level === 'warn' ? console.error : console.log
  if (env.NODE_ENV === 'production') {
    out(JSON.stringify({ time: new Date().toISOString(), level, message, ...fields }))
  } else {
    const extra = Object.keys(fields).length ? ` ${JSON.stringify(fields)}` : ''
    out(`${level.toUpperCase().padEnd(5)} ${message}${extra}`)
  }
}

export const logger = {
  debug: (message, fields) => write('debug', message, fields),
  info: (message, fields) => write('info', message, fields),
  warn: (message, fields) => write('warn', message, fields),
  error: (message, fields) => write('error', message, fields),
}

/** Error details safe to log: no request body, only what helps find the bug */
export const errorFields = (error) => ({ error: error?.message, ...(error?.stack && { stack: error.stack.split('\n').slice(0, 8).join('\n') }) })
