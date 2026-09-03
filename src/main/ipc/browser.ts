import { app, ipcMain, WebContentsView } from 'electron'
import type { BrowserWindow } from 'electron'
import {
  FIND_IN_PAGE_TIMEOUT_MS,
  emptyFindMatch,
  findResultFromEvent,
  parseFindInPageRequest
} from '../../shared/find-in-page'
import { errorCodes, ipcError, ipcOk, type IpcResult } from '../../shared/ipc-result'
import {
  getBrowserSession,
  setBrowserInsecureCerts,
  setBrowserProxyRules,
  setBrowserRequestFilter
} from '../services/browser-session'
import { getMainWindow } from '../windows/main'
import { browserViewBounds, isBrowserRoute, normalizeBrowserUrl } from '../windows/browser-policy'
import { attachPackagedContextMenu } from '../windows/window-security'

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
  if (app.isPackaged) attachPackagedContextMenu(wc)
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

type FindWait = {
  resolve: (value: { activeMatchOrdinal: number; matches: number }) => void
  cleanup: () => void
}

let findWait: FindWait | null = null

function cancelFindWait(): void {
  if (!findWait) return
  const pending = findWait
  findWait = null
  pending.cleanup()
  pending.resolve(emptyFindMatch())
}

function waitForFind(
  wc: Electron.WebContents
): Promise<{ activeMatchOrdinal: number; matches: number }> {
  cancelFindWait()
  return new Promise((resolve) => {
    const onFound = (
      _event: Electron.Event,
      result: { finalUpdate?: boolean; activeMatchOrdinal?: number; matches?: number }
    ): void => {
      const picked = findResultFromEvent(result)
      if (!picked) return
      finish(picked)
    }
    const timer = setTimeout(() => {
      finish(emptyFindMatch())
    }, FIND_IN_PAGE_TIMEOUT_MS)
    const cleanup = (): void => {
      clearTimeout(timer)
      if (!wc.isDestroyed()) wc.removeListener('found-in-page', onFound)
    }
    const finish = (value: { activeMatchOrdinal: number; matches: number }): void => {
      if (findWait?.cleanup !== cleanup) return
      findWait = null
      cleanup()
      resolve(value)
    }
    findWait = { resolve, cleanup }
    wc.on('found-in-page', onFound)
  })
}

async function findInBrowser(
  query: unknown,
  action: unknown
): Promise<IpcResult<{ activeMatchOrdinal: number; matches: number }>> {
  const parsed = parseFindInPageRequest(query, action)
  if (!parsed.ok) {
    return ipcError(errorCodes.VALIDATION, parsed.message)
  }
  const wc = browserView?.webContents
  if (!browserView || !wc || wc.isDestroyed()) {
    return ipcError(errorCodes.VALIDATION, '浏览器尚未创建')
  }
  if (parsed.kind === 'stop') {
    cancelFindWait()
    wc.stopFindInPage('clearSelection')
    return ipcOk(emptyFindMatch())
  }
  const pending = waitForFind(wc)
  wc.findInPage(parsed.query, parsed.options)
  return ipcOk(await pending)
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

function setNetworkFilter(enabled: unknown): IpcResult<null> {
  if (typeof enabled !== 'boolean') {
    return ipcError(errorCodes.VALIDATION, '过滤开关无效')
  }
  setBrowserRequestFilter(enabled)
  return ipcOk(null)
}

async function setNetworkProxy(rules: unknown): Promise<IpcResult<null>> {
  if (typeof rules !== 'string') {
    return ipcError(errorCodes.VALIDATION, '代理规则无效')
  }
  await setBrowserProxyRules(rules)
  return ipcOk(null)
}

function setInsecureCerts(enabled: unknown): IpcResult<null> {
  if (typeof enabled !== 'boolean') {
    return ipcError(errorCodes.VALIDATION, '证书开关无效')
  }
  const result = setBrowserInsecureCerts(enabled, app.isPackaged)
  if (!result.ok) {
    return ipcError(errorCodes.PLATFORM, '正式包不允许关闭证书校验')
  }
  return ipcOk(null)
}

export function registerBrowserIpc(): void {
  ipcMain.handle('browser:create', () => attachBrowserView())
  ipcMain.handle('browser:navigate', (_event, url: unknown) => navigateBrowser(url))
  ipcMain.handle('browser:go', (_event, action: unknown) => goBrowser(action))
  ipcMain.handle('browser:find', (_event, query: unknown, action: unknown) =>
    findInBrowser(query, action)
  )
  ipcMain.handle('network:set-filter', (_event, enabled: unknown) => setNetworkFilter(enabled))
  ipcMain.handle('network:set-proxy', (_event, rules: unknown) => setNetworkProxy(rules))
  ipcMain.handle('network:set-insecure-certs', (_event, enabled: unknown) =>
    setInsecureCerts(enabled)
  )
}
