import { ipcMain, WebContentsView } from 'electron'
import type { BrowserWindow } from 'electron'
import { errorCodes, ipcError, ipcOk, type IpcResult } from '../../shared/ipc-result'
import { getBrowserSession } from '../services/browser-session'
import { getMainWindow } from '../windows/main'
import { browserViewBounds, isBrowserRoute, normalizeBrowserUrl } from '../windows/browser-policy'

let browserView: WebContentsView | null = null
let attached = false

function emitNav(): void {
  const win = getMainWindow()
  const wc = browserView?.webContents
  if (!win || win.isDestroyed() || !wc || wc.isDestroyed()) return
  win.webContents.send('browser:nav', {
    url: wc.getURL(),
    canBack: wc.navigationHistory.canGoBack(),
    canForward: wc.navigationHistory.canGoForward()
  })
}

function updateBounds(win: BrowserWindow): void {
  if (!browserView || !attached) return
  const [width, height] = win.getContentSize()
  browserView.setBounds(browserViewBounds({ width, height }))
}

function createView(): WebContentsView {
  const view = new WebContentsView({
    webPreferences: {
      session: getBrowserSession(),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  })
  const wc = view.webContents
  wc.setWindowOpenHandler(({ url }) => {
    const parsed = normalizeBrowserUrl(url)
    if (parsed.ok) void wc.loadURL(parsed.url)
    return { action: 'deny' }
  })
  wc.on('will-navigate', (event, url) => {
    if (!normalizeBrowserUrl(url).ok) event.preventDefault()
  })
  wc.on('did-navigate', emitNav)
  wc.on('did-navigate-in-page', emitNav)
  wc.on('did-finish-load', emitNav)
  wc.on('did-redirect-navigation', emitNav)
  return view
}

export function detachBrowserView(): void {
  const win = getMainWindow()
  if (win && !win.isDestroyed() && browserView && attached) {
    win.contentView.removeChildView(browserView)
  }
  attached = false
}

function attachBrowserView(): IpcResult<null> {
  const win = getMainWindow()
  if (!win) {
    return ipcError(errorCodes.PLATFORM, '主窗口不可用')
  }
  if (!isBrowserRoute(win.webContents.getURL())) {
    detachBrowserView()
    return ipcOk(null)
  }
  if (!browserView) {
    browserView = createView()
  }
  if (!attached) {
    win.contentView.addChildView(browserView)
    attached = true
  }
  updateBounds(win)
  emitNav()
  return ipcOk(null)
}

function navigateBrowser(url: unknown): IpcResult<null> {
  const parsed = normalizeBrowserUrl(typeof url === 'string' ? url : '')
  if (!parsed.ok) {
    return ipcError(errorCodes.VALIDATION, parsed.message)
  }
  if (!browserView) {
    return ipcError(errorCodes.VALIDATION, '浏览器尚未创建')
  }
  void browserView.webContents.loadURL(parsed.url)
  return ipcOk(null)
}

function goBrowser(action: unknown): IpcResult<null> {
  if (action !== 'back' && action !== 'forward' && action !== 'reload') {
    return ipcError(errorCodes.VALIDATION, '导航动作无效')
  }
  if (!browserView) {
    return ipcError(errorCodes.VALIDATION, '浏览器尚未创建')
  }
  const history = browserView.webContents.navigationHistory
  if (action === 'back') history.goBack()
  else if (action === 'forward') history.goForward()
  else browserView.webContents.reload()
  return ipcOk(null)
}

export function watchBrowserRoute(win: BrowserWindow): void {
  const sync = (): void => {
    if (!isBrowserRoute(win.webContents.getURL())) {
      detachBrowserView()
    }
  }
  win.webContents.on('did-navigate-in-page', sync)
  win.webContents.on('did-navigate', sync)
  win.on('resize', () => updateBounds(win))
  win.on('closed', () => detachBrowserView())
}

export function registerBrowserIpc(): void {
  ipcMain.handle('browser:create', () => attachBrowserView())
  ipcMain.handle('browser:navigate', (_event, url: unknown) => navigateBrowser(url))
  ipcMain.handle('browser:go', (_event, action: unknown) => goBrowser(action))
}
