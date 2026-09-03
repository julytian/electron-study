import { app } from 'electron'
import log from 'electron-log/main'
import {
  formatChildProcessGoneMessage,
  formatRenderProcessGoneMessage,
  shouldReloadRenderer
} from '../../shared/process-gone'
import { getMainWindow } from '../windows/main'
import { recordLabEvent } from './lab-events'

let attached = false
let consecutiveReloads = 0
let loadHookedId: number | null = null

function hookMainLoadReset(): void {
  const win = getMainWindow()
  if (!win || win.isDestroyed()) return
  const id = win.webContents.id
  if (loadHookedId === id) return
  loadHookedId = id
  win.webContents.on('did-finish-load', () => {
    consecutiveReloads = 0
  })
}

export function notifyMainWindowCreated(): void {
  consecutiveReloads = 0
  hookMainLoadReset()
}

export function attachProcessRecovery(): void {
  if (attached) return
  attached = true
  hookMainLoadReset()

  app.on('render-process-gone', (_event, webContents, details) => {
    const main = getMainWindow()
    const isMainWindow = Boolean(
      main && !main.isDestroyed() && webContents.id === main.webContents.id
    )
    if (isMainWindow) hookMainLoadReset()
    const reason = details.reason || 'unknown'
    const exitCode = details.exitCode ?? 'unknown'
    const reload =
      shouldReloadRenderer({
        isMainWindow,
        reason,
        consecutiveReloads
      }) && !webContents.isDestroyed()
    if (reload) {
      consecutiveReloads += 1
      try {
        webContents.reload()
      } catch (error) {
        log.error(error)
      }
    }
    recordLabEvent(
      'process',
      'render-process-gone',
      reload,
      formatRenderProcessGoneMessage({
        reason,
        exitCode,
        isMainWindow,
        reload,
        count: consecutiveReloads
      })
    )
  })

  app.on('child-process-gone', (_event, details) => {
    const message = formatChildProcessGoneMessage({
      type: details.type || 'unknown',
      reason: details.reason || 'unknown',
      exitCode: details.exitCode ?? 'unknown'
    })
    log.warn(message)
    recordLabEvent('process', 'child-process-gone', false, message)
  })
}
