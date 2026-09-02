import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { setupLogger } from './services/logger'
import { ensureAppDirs } from './services/paths'
import { openDatabase, closeDatabase } from './services/db'
import { createMainWindow, getMainWindow } from './windows/main'
import { registerIpc } from './ipc/register'

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = getMainWindow()
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  })
}

app.whenReady().then(() => {
  if (!gotLock) return

  const log = setupLogger()
  process.on('uncaughtException', (error) => {
    log.error(error)
  })
  process.on('unhandledRejection', (reason) => {
    log.error(reason)
  })

  electronApp.setAppUserModelId('com.electronlab.app')
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  try {
    ensureAppDirs()
    openDatabase()
  } catch (error) {
    log.error(error)
    app.quit()
    return
  }

  registerIpc()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  closeDatabase()
})
