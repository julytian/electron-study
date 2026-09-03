import { ipcMain } from 'electron'
import { errorCodes, ipcError, ipcOk, type IpcResult } from '../../shared/ipc-result'
import { getDatabase } from '../services/db'
import { createSafeStorage } from '../services/crypto'
import { createNotesService } from '../services/notes'

function wrap(run: () => unknown): IpcResult<unknown> {
  try {
    return ipcOk(run())
  } catch (error) {
    const name = error instanceof Error ? error.name : ''
    const message = error instanceof Error ? error.message : 'Unknown'
    if (name === 'E_NOT_FOUND') return ipcError(errorCodes.NOT_FOUND, message)
    if (name === 'E_ENCRYPT') return ipcError(errorCodes.ENCRYPT, message)
    return ipcError(errorCodes.VALIDATION, message)
  }
}

export function registerNotesIpc(): void {
  const notes = (): ReturnType<typeof createNotesService> =>
    createNotesService(getDatabase(), createSafeStorage())
  ipcMain.handle('notes:list', (_e, query?: string) => wrap(() => notes().list(query)))
  ipcMain.handle('notes:get', (_e, id: number) => wrap(() => notes().get(id)))
  ipcMain.handle('notes:create', (_e, input) => wrap(() => notes().create(input)))
  ipcMain.handle('notes:update', (_e, input) => wrap(() => notes().update(input)))
  ipcMain.handle('notes:delete', (_e, id: number) => wrap(() => notes().delete(id)))
}
