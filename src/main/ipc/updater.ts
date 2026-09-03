import { app, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import { errorCodes, ipcError, ipcOk, type IpcResult } from '../../shared/ipc-result'
import type { UpdaterStatus } from '../../shared/models'
import { getSettings } from '../services/conf'
import {
  bindPackagedCheck,
  createUpdaterMachine,
  readPackageRepository,
  setUpdaterMachine,
  statusForProgress,
  type UpdaterMachine,
  type UpdaterStatusPayload
} from '../services/updater'
import { getMainWindow } from '../windows/main'

function wrap(run: () => unknown): IpcResult<unknown> {
  try {
    return ipcOk(run())
  } catch (error) {
    const message = error instanceof Error ? error.message : '更新失败'
    return ipcError(errorCodes.UPDATE, message)
  }
}

function sendStatus(event: UpdaterStatusPayload): void {
  const win = getMainWindow()
  if (!win || win.isDestroyed()) return
  win.webContents.send('updater:status', event)
}

function sendProgress(percent: number): void {
  const win = getMainWindow()
  if (!win || win.isDestroyed()) return
  win.webContents.send('updater:progress', { percent })
}

function applyAutoDownload(): void {
  autoUpdater.autoDownload = getSettings().updater.autoDownload
}

function startRealCheck(machine: UpdaterMachine): void {
  applyAutoDownload()
  machine.setStatus('checking')
  void autoUpdater.checkForUpdates().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    machine.setStatus('error', { message })
  })
}

function startRealDownload(machine: UpdaterMachine): void {
  applyAutoDownload()
  machine.setStatus('downloading')
  void autoUpdater.downloadUpdate().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    machine.setStatus('error', { message })
  })
}

function wireAutoUpdater(machine: UpdaterMachine): void {
  autoUpdater.on('checking-for-update', () => {
    machine.setStatus('checking')
  })
  autoUpdater.on('update-available', (info) => {
    const autoDownload = getSettings().updater.autoDownload
    machine.setStatus(autoDownload ? 'downloading' : 'available', { version: info.version })
  })
  autoUpdater.on('update-not-available', (info) => {
    machine.setStatus('not-available', { version: info.version })
  })
  autoUpdater.on('error', (error) => {
    machine.setStatus('error', { message: error.message })
  })
  autoUpdater.on('update-downloaded', (info) => {
    machine.setStatus('downloaded', { version: info.version })
  })
  autoUpdater.on('download-progress', (progress) => {
    const next = statusForProgress(machine.status, getSettings().updater.autoDownload)
    if (next !== machine.status) {
      machine.setStatus(next)
    }
    sendProgress(progress.percent)
  })
}

export function registerUpdaterIpc(): void {
  const repository = readPackageRepository(app.getAppPath())
  const canUseReal = app.isPackaged && repository !== null
  const machine = createUpdaterMachine({ packaged: canUseReal })
  setUpdaterMachine(machine)
  machine.onStatus(sendStatus)

  if (canUseReal) {
    applyAutoDownload()
    wireAutoUpdater(machine)
    bindPackagedCheck(() => {
      startRealCheck(machine)
    })
  } else {
    bindPackagedCheck(undefined)
  }

  ipcMain.handle('updater:check', () =>
    wrap(() => {
      if (canUseReal) {
        startRealCheck(machine)
        return { status: machine.status, version: machine.version }
      }
      return machine.check()
    })
  )

  ipcMain.handle('updater:download', () =>
    wrap(() => {
      if (canUseReal) {
        startRealDownload(machine)
      } else {
        machine.download()
      }
      return null
    })
  )

  ipcMain.handle('updater:install', () =>
    wrap(() => {
      const action = machine.install()
      if (action === 'quit' && canUseReal) {
        autoUpdater.quitAndInstall()
      }
      return null
    })
  )

  ipcMain.handle('updater:mock', (_event, status: UpdaterStatus) =>
    wrap(() => {
      machine.mock(status)
      return null
    })
  )
}

