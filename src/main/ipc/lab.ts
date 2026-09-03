import { ipcMain } from 'electron'
import { errorCodes, ipcError, ipcOk } from '../../shared/ipc-result'
import { applyTouchBar, refreshDockMenu } from '../platforms/mac'
import { refreshWindowsJumpList } from '../platforms/win'
import { getDatabase } from '../services/db'

function recordLabEvent(module: string, action: string, ok: boolean, message: string): void {
  try {
    getDatabase()
      .prepare(
        'INSERT INTO lab_events (module, action, ok, message, created_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(module, action, ok ? 1 : 0, message, Date.now())
  } catch {
    // 记录失败不影响实验室动作本身
  }
}

function mapLabError(error: unknown): ReturnType<typeof ipcError> {
  const name = error instanceof Error ? error.name : ''
  const message = error instanceof Error ? error.message : String(error)
  if (name.includes('E_PLATFORM') || message.includes('E_PLATFORM')) {
    return ipcError(errorCodes.PLATFORM, message)
  }
  throw error
}

export function registerLabIpc(): void {
  ipcMain.handle('lab:run', (_event, module: string, action: string) => {
    try {
      if (module !== 'platform') {
        const result = ipcError(errorCodes.VALIDATION, `未知实验室动作: ${module}/${action}`)
        recordLabEvent(module, action, false, result.error.message)
        return result
      }

      if (action === 'refresh-jump-list') {
        const data = refreshWindowsJumpList()
        recordLabEvent(module, action, true, data.message)
        return ipcOk(data)
      }
      if (action === 'refresh-dock') {
        const data = refreshDockMenu()
        recordLabEvent(module, action, true, data.message)
        return ipcOk(data)
      }
      if (action === 'set-touchbar') {
        const data = applyTouchBar()
        recordLabEvent(module, action, true, data.message)
        return ipcOk(data)
      }

      const result = ipcError(errorCodes.VALIDATION, `未知实验室动作: ${module}/${action}`)
      recordLabEvent(module, action, false, result.error.message)
      return result
    } catch (error) {
      const mapped = mapLabError(error)
      recordLabEvent(module, action, false, mapped.error.message)
      return mapped
    }
  })
}
