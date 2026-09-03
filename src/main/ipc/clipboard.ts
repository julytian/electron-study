import { clipboard, ipcMain } from 'electron'
import { errorCodes, ipcError, ipcOk, type IpcResult } from '../../shared/ipc-result'
import { createClipboardService } from '../services/clipboard'
import { getDatabase } from '../services/db'
import { ensureAppDirs } from '../services/paths'

function wrap(run: () => unknown): IpcResult<unknown> {
  try {
    return ipcOk(run())
  } catch (error) {
    const name = error instanceof Error ? error.name : ''
    const message = error instanceof Error ? error.message : 'Unknown'
    if (name === 'E_PATH') return ipcError(errorCodes.PATH, message)
    if (name === 'E_VALIDATION') return ipcError(errorCodes.VALIDATION, message)
    return ipcError(errorCodes.VALIDATION, message)
  }
}

export function registerClipboardIpc(): void {
  const service = (): ReturnType<typeof createClipboardService> =>
    createClipboardService(getDatabase(), clipboard, ensureAppDirs().clipboardDir)

  ipcMain.handle('clipboard:read', () => wrap(() => service().read()))
  ipcMain.handle('clipboard:write', (_event, input) => wrap(() => service().write(input)))
  ipcMain.handle('clipboard:history', () => wrap(() => service().history()))
  ipcMain.handle('clipboard:clear-history', () =>
    wrap(() => {
      service().clearHistory()
      return null
    })
  )
}
