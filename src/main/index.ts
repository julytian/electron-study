import { app, BrowserWindow, crashReporter, session } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { setupLogger } from './services/logger'
import { ensureAppDirs } from './services/paths'
import { openDatabase, closeDatabase } from './services/db'
import { getSettings } from './services/conf'
import { checkUpdates } from './services/updater'
import { createTray, destroyTray } from './services/tray'
import { registerShortcuts } from './services/shortcuts'
import { watchBrowserRoute } from './ipc/browser'
import { createMainWindow, getMainWindow, setAppQuitting } from './windows/main'
import { registerIpc } from './ipc/register'
import { isDefaultSessionPermissionAllowed } from './services/session-permissions'
import { refreshDockMenu } from './platforms/mac'
import { refreshWindowsJumpList } from './platforms/win'
import { purgeMissingRecentFiles, rebuildSystemRecentDocuments } from './services/recent-documents'
import {
  extractFileFromArgv,
  extractUrlFromArgv,
  flushDeepLinkQueue,
  flushPendingOpenFiles,
  handleDeepLinkUrl,
  handleOpenFile,
  registerProtocol
} from './services/protocol'

let autoCheckTimer: ReturnType<typeof setTimeout> | undefined

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

  if (app.isPackaged) {
    crashReporter.start({
      submitURL: '',
      uploadToServer: false,
      extra: { app: 'electron-lab' }
    })
  }

  const log = setupLogger()
  process.on('uncaughtException', (error) => {
    log.error(error)
  })
  process.on('unhandledRejection', (reason) => {
    log.error(reason)
  })

  electronApp.setAppUserModelId('com.electronlab.app')
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(isDefaultSessionPermissionAllowed(permission))
  })
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

  purgeMissingRecentFiles()
  rebuildSystemRecentDocuments()

  registerIpc()
  registerProtocol()
  watchBrowserRoute(createMainWindow())
  try {
    if (process.platform === 'win32') refreshWindowsJumpList()
    if (process.platform === 'darwin') refreshDockMenu()
  } catch (error) {
    log.error(error)
  }
  flushPendingOpenFiles()
  handleIncomingArgv(process.argv)
  flushDeepLinkQueue()
  createTray()
  registerShortcuts()

  if (app.isPackaged && getSettings().updater.autoCheck) {
    autoCheckTimer = setTimeout(() => {
      autoCheckTimer = undefined
      checkUpdates()
    }, 10_000)
  }

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
  if (autoCheckTimer !== undefined) {
    clearTimeout(autoCheckTimer)
    autoCheckTimer = undefined
  }
  setAppQuitting()
  destroyTray()
  closeDatabase()
})
