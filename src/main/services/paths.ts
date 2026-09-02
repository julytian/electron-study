import { app } from 'electron'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'

export function getAppUserData(): string {
  const base = app.getPath('userData')
  return app.isPackaged ? base : `${base}-dev`
}

export function ensureAppDirs(): {
  userData: string
  dbFile: string
  clipboardDir: string
  logsDir: string
  exportsDir: string
} {
  const userData = getAppUserData()
  const clipboardDir = join(userData, 'clipboard')
  const logsDir = join(userData, 'logs')
  const exportsDir = join(userData, 'exports')
  mkdirSync(clipboardDir, { recursive: true })
  mkdirSync(logsDir, { recursive: true })
  mkdirSync(exportsDir, { recursive: true })
  return {
    userData,
    dbFile: join(userData, 'app.db'),
    clipboardDir,
    logsDir,
    exportsDir
  }
}
