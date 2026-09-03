import { ipcMain, MessageChannelMain } from 'electron'
import type { BrowserWindow } from 'electron'
import { errorCodes, ipcError, ipcOk } from '../../shared/ipc-result'
import { createChildWindow, createFloatWindow } from '../windows/child'
import { TITLE_BAR_OVERLAY, isValidProgress } from '../windows/child-policy'
import { getMainWindow } from '../windows/main'

let portLeft: BrowserWindow | null = null
let portRight: BrowserWindow | null = null

function postPortWhenReady(win: BrowserWindow, port: Electron.MessagePortMain): void {
  const send = (): void => {
    win.webContents.postMessage('port', null, [port])
  }
  if (win.webContents.isLoading()) {
    win.webContents.once('did-finish-load', send)
    return
  }
  send()
}

function createPortPair(): void {
  const left = createChildWindow('/ports/left')
  const right = createChildWindow('/ports/right')
  portLeft = left
  portRight = right
  left.on('closed', () => {
    if (portLeft === left) portLeft = null
  })
  right.on('closed', () => {
    if (portRight === right) portRight = null
  })

  const { port1, port2 } = new MessageChannelMain()
  postPortWhenReady(left, port1)
  postPortWhenReady(right, port2)
}

function sendPortMessage(side: 'left' | 'right', text: string): void {
  const payload = { side, text }
  portLeft?.webContents.send('port:message', payload)
  portRight?.webContents.send('port:message', payload)
}

export function registerWindowsIpc(): void {
  ipcMain.handle('window:create-child', () => {
    createChildWindow()
    return ipcOk(null)
  })

  ipcMain.handle('window:create-float', () => {
    createFloatWindow()
    return ipcOk(null)
  })

  ipcMain.handle('window:set-progress', (_e, value: number) => {
    if (!isValidProgress(value)) {
      return ipcError(errorCodes.VALIDATION, '进度条取值必须在 0 到 1 之间')
    }
    getMainWindow()?.setProgressBar(value)
    return ipcOk(null)
  })

  ipcMain.handle('window:set-fullscreen', (_e, flag: boolean) => {
    getMainWindow()?.setFullScreen(flag)
    return ipcOk(null)
  })

  ipcMain.handle('window:set-overlay', (_e, enabled: boolean) => {
    const win = getMainWindow()
    if (!win) {
      return ipcError(errorCodes.PLATFORM, '主窗口不可用，无法设置 titleBarOverlay')
    }
    try {
      if (enabled) {
        win.setTitleBarOverlay(TITLE_BAR_OVERLAY)
      } else {
        win.setTitleBarOverlay({ height: 0 })
      }
      return ipcOk(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : '当前平台不支持 titleBarOverlay'
      return ipcError(errorCodes.PLATFORM, message)
    }
  })

  ipcMain.handle('port:create-pair', () => {
    createPortPair()
    return ipcOk(null)
  })

  ipcMain.handle('port:send', (_e, side: 'left' | 'right', text: string) => {
    if (side !== 'left' && side !== 'right') {
      return ipcError(errorCodes.VALIDATION, 'side 只能是 left 或 right')
    }
    if (typeof text !== 'string' || text.trim() === '') {
      return ipcError(errorCodes.VALIDATION, '消息不能为空')
    }
    sendPortMessage(side, text)
    return ipcOk(null)
  })
}
