import { ipcMain } from 'electron'
import { ipcOk } from '../../shared/ipc-result'
import { patchSettings } from '../services/conf'
import { registerProtocol } from '../services/protocol'

export function registerProtocolIpc(): void {
  ipcMain.handle('protocol:register', () => {
    const ok = registerProtocol()
    patchSettings({ protocol: { registered: true } })
    return ipcOk({ ok })
  })
}
