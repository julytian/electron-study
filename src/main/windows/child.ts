import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import { buildRendererLoad } from './child-policy'
import { attachRendererNavigation } from './navigation'

const children = new Set<BrowserWindow>()

const childWebPreferences = {
  preload: join(__dirname, '../preload/index.js'),
  sandbox: true,
  contextIsolation: true,
  nodeIntegration: false,
  webSecurity: true
}

function load(win: BrowserWindow, hash: string): void {
  const target = buildRendererLoad(hash, {
    isDev: is.dev,
    rendererUrl: process.env['ELECTRON_RENDERER_URL']
  })
  if (target.kind === 'url') {
    void win.loadURL(target.url)
    return
  }
  void win.loadFile(join(__dirname, '../renderer/index.html'), { hash: target.hash })
}

function track(win: BrowserWindow): void {
  children.add(win)
  win.on('closed', () => children.delete(win))
}

export function createChildWindow(hash = '/windows/lab'): BrowserWindow {
  const win = new BrowserWindow({
    width: 640,
    height: 420,
    parent: undefined,
    webPreferences: childWebPreferences
  })
  track(win)
  attachRendererNavigation(win)
  load(win, hash)
  return win
}

export function createFloatWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 360,
    height: 240,
    alwaysOnTop: true,
    webPreferences: childWebPreferences
  })
  track(win)
  attachRendererNavigation(win)
  load(win, '/windows/lab')
  return win
}

export function closeAllChildren(): void {
  for (const win of children) win.close()
  children.clear()
}
