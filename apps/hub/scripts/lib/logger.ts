export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
}

let currentLevel: LogLevel = 'info'

export function setLogLevel(level: LogLevel): void {
  currentLevel = level
}

export const logger = {
  debug: (...args: unknown[]) => {
    if (LOG_LEVELS[currentLevel] <= LOG_LEVELS.debug)
      console.debug('[DEBUG]', ...args)
  },
  info: (...args: unknown[]) => {
    if (LOG_LEVELS[currentLevel] <= LOG_LEVELS.info) console.log(...args)
  },
  warn: (...args: unknown[]) => {
    if (LOG_LEVELS[currentLevel] <= LOG_LEVELS.warn)
      console.warn('[WARN]', ...args)
  },
  error: (...args: unknown[]) => {
    if (LOG_LEVELS[currentLevel] <= LOG_LEVELS.error)
      console.error('[ERROR]', ...args)
  }
}
