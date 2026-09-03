import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import { getSettings, patchSettings } from '../services/conf'
import { notifyMainWindowCreated } from '../services/process-recovery'
import { closeAllChildren } from './child'
import { attachRendererNavigation } from './navigation'
import { attachWindowSecurity } from './window-security'
import { shouldHideToTray, withHash } from './window-policy'

let mainWindow: BrowserWindow | null = null
let quitting = false

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

export function setAppQuitting(): void {
  quitting = true
}

function loadMainWindow(win: BrowserWindow, hash?: string): void {
  const route = hash ?? getSettings().ui.lastRoute
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const base = process.env['ELECTRON_RENDERER_URL']
    void win.loadURL(route ? withHash(base, route) : base)
    return
  }
  void win.loadFile(join(__dirname, '../renderer/index.html'), {
    hash: route ? route.replace(/^#/, '') : undefined
  })
}

function navigateMainWindow(win: BrowserWindow, hash: string): void {
  const current = win.webContents.getURL()
  if (!current) {
    loadMainWindow(win, hash)
    return
  }
  const next = withHash(current, hash)
  if (next !== current) {
    void win.loadURL(next)
  }
}

export function showMainWindow(hash?: string): BrowserWindow {
  const existed = mainWindow
  const win = existed ?? createMainWindow(hash)
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
  if (hash) {
    patchSettings({ ui: { lastRoute: hash } })
    if (existed) navigateMainWindow(win, hash)
  }
  return win
}

export function toggleMainWindow(): void {
  const win = mainWindow
  if (!win) {
    createMainWindow()
    return
  }
  if (win.isVisible() && !win.isMinimized() && win.isFocused()) {
    win.hide()
    return
  }
  showMainWindow()
}

export function createMainWindow(hash?: string): BrowserWindow {
  const saved = getSettings().window.main
  mainWindow = new BrowserWindow({
    width: saved.width,
    height: saved.height,
    x: saved.x,
    y: saved.y,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  })

  if (saved.isMaximized) mainWindow.maximize()

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('close', (event) => {
    if (!mainWindow) return
    const bounds = mainWindow.getBounds()
    patchSettings({
      window: {
        main: {
          ...bounds,
          isMaximized: mainWindow.isMaximized()
        }
      }
    })
    if (
      shouldHideToTray({
        closeToTray: getSettings().behavior.closeToTray,
        platform: process.platform,
        quitting
      })
    ) {
      event.preventDefault()
      mainWindow.hide()
    }
  })

  mainWindow.on('closed', () => {
    closeAllChildren()
    mainWindow = null
  })

  attachRendererNavigation(mainWindow)
  attachWindowSecurity(mainWindow, app.isPackaged)
  loadMainWindow(mainWindow, hash)
  notifyMainWindowCreated()

  return mainWindow
}
