import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { setupLogger } from './services/logger'
import { ensureAppDirs } from './services/paths'
import { openDatabase, closeDatabase } from './services/db'
import { createTray, destroyTray } from './services/tray'
import { registerShortcuts } from './services/shortcuts'
import { watchBrowserRoute } from './ipc/browser'
import { createMainWindow, getMainWindow, setAppQuitting } from './windows/main'
import { registerIpc } from './ipc/register'
import {
  extractFileFromArgv,
  extractUrlFromArgv,
  flushDeepLinkQueue,
  flushPendingOpenFiles,
  handleDeepLinkUrl,
  handleOpenFile,
  registerProtocol
} from './services/protocol'

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    const win = getMainWindow()
    if (win) {
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
    }
    handleIncomingArgv(argv)
  })
}

app.on('open-url', (event, url) => {
  event.preventDefault()
  handleDeepLinkUrl(url)
})

app.on('open-file', (event, filePath) => {
  event.preventDefault()
  handleOpenFile(filePath)
})

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
  registerProtocol()
  watchBrowserRoute(createMainWindow())
  flushPendingOpenFiles()
  handleIncomingArgv(process.argv)
  flushDeepLinkQueue()
  createTray()
  registerShortcuts()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      watchBrowserRoute(createMainWindow())
      flushDeepLinkQueue()
    }
  })
})

function handleIncomingArgv(argv: string[]): void {
  const url = extractUrlFromArgv(argv)
  if (url) handleDeepLinkUrl(url)
  const filePath = extractFileFromArgv(argv)
  if (filePath) handleOpenFile(filePath)
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  setAppQuitting()
  destroyTray()
  closeDatabase()
})
