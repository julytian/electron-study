import log from 'electron-log/main'
import { join } from 'node:path'
import { dailyLogFileName } from './daily-log'
import { ensureAppDirs } from './paths'

export function setupLogger(): typeof log {
  const { logsDir } = ensureAppDirs()
  log.transports.file.resolvePathFn = () => join(logsDir, dailyLogFileName())
  log.transports.file.maxSize = 1024 * 1024
  log.initialize()
  return log
}
