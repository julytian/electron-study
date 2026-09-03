import { shell, type BrowserWindow } from 'electron'
import { is } from '@electron-toolkit/utils'
import { isAllowedExternalUrl } from '../../shared/external-url'
import { isRendererNavigationAllowed } from './window-policy'

export function attachRendererNavigation(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    const current = win.webContents.getURL()
    if (isRendererNavigationAllowed(current, url, is.dev)) return
    event.preventDefault()
    if (isAllowedExternalUrl(url)) void shell.openExternal(url)
  })
}
