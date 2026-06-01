type LogLevel = 'INFO' | 'ERROR' | 'WARN'

function log(level: LogLevel, context: string, message: string): void {
  console[level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log'](
    `[${level}] [${context}] ${message}`
  )
}

export const logger = {
  info: (context: string, message: string) => log('INFO', context, message),
  error: (context: string, message: string) => log('ERROR', context, message),
  warn: (context: string, message: string) => log('WARN', context, message),
}

/**
 * Returns a logger bound to a fixed context, so call sites set the context once.
 * Example: `const log = createLogger('auth'); log.info('JWT validated')`
 */
export function createLogger(context: string) {
  return {
    info: (message: string) => log('INFO', context, message),
    error: (message: string) => log('ERROR', context, message),
    warn: (message: string) => log('WARN', context, message),
  }
}
