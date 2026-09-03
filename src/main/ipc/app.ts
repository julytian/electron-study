import { app, dialog, ipcMain, shell } from 'electron'
import { copyFileSync } from 'node:fs'
import { join } from 'node:path'
import { errorCodes, ipcError, ipcOk } from '../../shared/ipc-result'
import { isAllowedExternalUrl } from '../../shared/external-url'
import type { AppInfo, AppSettings } from '../../shared/models'
import { getSettings, patchSettings } from '../services/conf'
import { registerShortcuts } from '../services/shortcuts'
import { getUpdaterMachine, readPackageRepository } from '../services/updater'
import { clearBusinessTables, getDatabase } from '../services/db'
import { assertWithinRoot } from '../services/path-jail'
import { ensureAppDirs } from '../services/paths'

export function registerAppIpc(): void {
  ipcMain.handle('app:get-info', () => {
    const { userData } = ensureAppDirs()
    let dbReady = true
    try {
      getDatabase()
    } catch {
      dbReady = false
    }
    const data: AppInfo = {
      name: app.getName(),
      version: app.getVersion(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      platform: process.platform,
      arch: process.arch,
      isPackaged: app.isPackaged,
      userData,
      dbReady,
      updaterStatus: getUpdaterMachine().status,
      hasRepository: readPackageRepository(app.getAppPath()) !== null
    }
    return ipcOk(data)
  })

  ipcMain.handle('conf:get', () => ipcOk(getSettings()))
  ipcMain.handle('conf:set', (_event, patch: Partial<AppSettings>) => {
    const next = patchSettings(patch)
    if (patch.shortcuts) registerShortcuts()
    return ipcOk(next)
  })

  ipcMain.handle('db:status', () => {
    const { dbFile } = ensureAppDirs()
    try {
      getDatabase()
      return ipcOk({ ready: true, path: dbFile })
    } catch {
      return ipcOk({ ready: false, path: dbFile })
    }
  })

  ipcMain.handle('db:export', async () => {
    const { dbFile, exportsDir } = ensureAppDirs()
    const result = await dialog.showSaveDialog({
      defaultPath: join(exportsDir, 'app.db')
    })
    if (result.canceled || !result.filePath) {
      return ipcError(errorCodes.VALIDATION, '已取消导出')
    }
    copyFileSync(dbFile, result.filePath)
    return ipcOk({ path: result.filePath })
  })

  ipcMain.handle('db:clear', () => {
    clearBusinessTables()
    return ipcOk(null)
  })

  ipcMain.handle('shell:open-path', (_event, target: string) => {
    try {
      const { userData } = ensureAppDirs()
      const safe = assertWithinRoot(target, userData)
      void shell.openPath(safe)
      return ipcOk(null)
    } catch (error) {
      const name = error instanceof Error ? error.name : ''
      const message = error instanceof Error ? error.message : String(error)
      if (name === 'E_PATH' || message.includes('E_PATH')) {
        return ipcError(errorCodes.PATH, message)
      }
      throw error
    }
  })

  ipcMain.handle('shell:open-external', (_event, url: string) => {
    if (!isAllowedExternalUrl(url)) {
      return ipcError(errorCodes.VALIDATION, '不允许打开该协议')
    }
    void shell.openExternal(url)
    return ipcOk(null)
  })

  ipcMain.handle('shell:open-logs', () => {
    const { logsDir } = ensureAppDirs()
    void shell.openPath(logsDir)
    return ipcOk(null)
  })
}
