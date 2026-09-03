import { ipcMain } from 'electron'
import { errorCodes, ipcError, ipcOk, type IpcResult } from '../../shared/ipc-result'
import { patchSettings } from '../services/conf'
import { registerProtocol } from '../services/protocol'

function wrap(run: () => { ok: boolean }): IpcResult<{ ok: boolean }> {
  try {
    return ipcOk(run())
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown'
    return ipcError(errorCodes.PLATFORM, message)
  }
}

export function registerProtocolIpc(): void {
  ipcMain.handle('protocol:register', () =>
    wrap(() => {
      const ok = registerProtocol()
      if (ok) patchSettings({ protocol: { registered: true } })
      return { ok }
    })
  )
}
