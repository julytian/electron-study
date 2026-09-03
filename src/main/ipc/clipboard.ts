import { clipboard, ipcMain, nativeImage } from 'electron'
import { errorCodes, ipcError, ipcOk, type IpcResult } from '../../shared/ipc-result'
import { createClipboardService } from '../services/clipboard'
import type { SystemClipboard } from '../services/clipboard'
import { getDatabase } from '../services/db'
import { ensureAppDirs } from '../services/paths'

function systemClipboard(): SystemClipboard {
  return {
    readText: () => clipboard.readText(),
    readHTML: () => clipboard.readHTML(),
    readImage: () => clipboard.readImage(),
    writeText: (text) => clipboard.writeText(text),
    writeHTML: (html) => clipboard.writeHTML(html),
    writeImage: (png) => clipboard.writeImage(nativeImage.createFromBuffer(png))
  }
}

function wrap(run: () => unknown): IpcResult<unknown> {
  try {
    return ipcOk(run())
  } catch (error) {
    const name = error instanceof Error ? error.name : ''
    const message = error instanceof Error ? error.message : 'Unknown'
    if (name === 'E_PATH') return ipcError(errorCodes.PATH, message)
    if (name === 'E_VALIDATION') return ipcError(errorCodes.VALIDATION, message)
    if (name === 'E_NOT_FOUND') return ipcError(errorCodes.NOT_FOUND, message)
    return ipcError(errorCodes.VALIDATION, message)
  }
}

export function registerClipboardIpc(): void {
  const service = (): ReturnType<typeof createClipboardService> =>
    createClipboardService(getDatabase(), systemClipboard(), ensureAppDirs().clipboardDir)

  ipcMain.handle('clipboard:read', () => wrap(() => service().read()))
  ipcMain.handle('clipboard:write', (_event, input) => wrap(() => service().write(input)))
  ipcMain.handle('clipboard:history', () => wrap(() => service().history()))
  ipcMain.handle('clipboard:clear-history', () =>
    wrap(() => {
      service().clearHistory()
      return null
    })
  )
  ipcMain.handle('clipboard:restore', (_event, id: number) =>
    wrap(() => {
      service().restore(id)
      return null
    })
  )
  ipcMain.handle('clipboard:delete', (_event, id: number) =>
    wrap(() => {
      service().delete(id)
      return null
    })
  )
}
