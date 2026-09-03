import { app, ipcMain, nativeTheme, Notification, powerMonitor } from 'electron'
import { errorCodes, ipcError, ipcOk } from '../../shared/ipc-result'
import type { ThemeMode } from '../../shared/models'
import { getSettings, patchSettings } from '../services/conf'
import { getMainWindow, showMainWindow } from '../windows/main'

export function registerSystemIpc(): void {
  nativeTheme.themeSource = getSettings().appearance.theme

  ipcMain.handle(
    'system:notify',
    (_e, input: { title: string; body: string; route?: string }) => {
      const notify = new Notification({ title: input.title, body: input.body })
      notify.on('click', () => {
        if (input.route) {
          patchSettings({ ui: { lastRoute: input.route } })
          showMainWindow(input.route)
          return
        }
        getMainWindow()?.show()
      })
      notify.show()
      return ipcOk(null)
    }
  )

  ipcMain.handle('system:get-power', () =>
    ipcOk({
      onBattery: powerMonitor.isOnBatteryPower(),
      idleState: powerMonitor.getSystemIdleState(60)
    })
  )

  ipcMain.handle('system:set-theme', (_e, theme: ThemeMode) => {
    nativeTheme.themeSource = theme
    patchSettings({ appearance: { theme } })
    return ipcOk(null)
  })

  ipcMain.handle('system:set-login', (_e, enabled: boolean) => {
    try {
      app.setLoginItemSettings({ openAtLogin: enabled })
    } catch (error) {
      const message = error instanceof Error ? error.message : '当前平台不支持开机自启'
      return ipcError(errorCodes.PLATFORM, message)
    }
    patchSettings({ behavior: { ...getSettings().behavior, openAtLogin: enabled } })
    return ipcOk(null)
  })

  nativeTheme.on('updated', () => {
    const win = getMainWindow()
    if (!win || win.isDestroyed()) return
    win.webContents.send('theme:changed', { theme: nativeTheme.themeSource as ThemeMode })
  })

  const sendPower = (): void => {
    const win = getMainWindow()
    if (!win || win.isDestroyed()) return
    win.webContents.send('power:changed', { onBattery: powerMonitor.isOnBatteryPower() })
  }
  powerMonitor.on('on-ac', sendPower)
  powerMonitor.on('on-battery', sendPower)
}
