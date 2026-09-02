import log from 'electron-log/main'
import { join } from 'node:path'
import { ensureAppDirs } from './paths'

export function setupLogger(): typeof log {
  const { logsDir } = ensureAppDirs()
  log.transports.file.resolvePathFn = () => join(logsDir, 'main.log')
  log.transports.file.maxSize = 1024 * 1024
  log.initialize()
  return log
}
