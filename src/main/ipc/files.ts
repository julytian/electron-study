import { dialog, ipcMain, nativeImage, shell } from 'electron'
import { join } from 'node:path'
import { errorCodes, ipcError, ipcOk, type IpcResult } from '../../shared/ipc-result'
import { refreshWindowsJumpList } from '../platforms/win'
import { getDatabase } from '../services/db'
import { createFilesService } from '../services/files'
import { ensureAppDirs } from '../services/paths'
import { rememberSystemDocument, syncRecentMirrors } from '../services/recent-documents'

const sessionAllowlist = new Set<string>()

const FALLBACK_DRAG_ICON =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

function dragIcon(): Electron.NativeImage {
  const fromResources = nativeImage.createFromPath(join(__dirname, '../../resources/icon.png'))
  if (!fromResources.isEmpty()) return fromResources
  return nativeImage.createFromDataURL(FALLBACK_DRAG_ICON)
}

async function wrap(run: () => Promise<unknown> | unknown): Promise<IpcResult<unknown>> {
  try {
    return ipcOk(await run())
  } catch (error) {
    const name = error instanceof Error ? error.name : ''
    const message = error instanceof Error ? error.message : 'Unknown'
    if (name === 'E_PATH') return ipcError(errorCodes.PATH, message)
    if (name === 'E_NOT_FOUND') return ipcError(errorCodes.NOT_FOUND, message)
    return ipcError(errorCodes.VALIDATION, message)
  }
}

export function registerFilesIpc(): void {
  const dialogs = {
    showOpenDialog: (options?: {
      properties?: Array<'openFile' | 'openDirectory' | 'multiSelections'>
    }) => dialog.showOpenDialog(options ?? {}),
    showSaveDialog: (options?: { defaultPath?: string }) => dialog.showSaveDialog(options ?? {})
  }
  const files = (): ReturnType<typeof createFilesService> =>
    createFilesService(getDatabase(), ensureAppDirs().userData, dialogs, shell, sessionAllowlist)

  ipcMain.handle('files:open', () =>
    wrap(async () => {
      const result = await files().open()
      if (result) {
        rememberSystemDocument(result.path)
        if (process.platform === 'win32') {
          try {
            refreshWindowsJumpList()
          } catch {
            /* ignore */
          }
        }
      }
      return result
    })
  )
  ipcMain.handle('files:save', (_event, content: string) =>
    wrap(async () => {
      const result = await files().save(content)
      if (result) {
        rememberSystemDocument(result.path)
        if (process.platform === 'win32') {
          try {
            refreshWindowsJumpList()
          } catch {
            /* ignore */
          }
        }
      }
      return result
    })
  )
  ipcMain.handle('files:show-in-folder', (_event, target: string) =>
    wrap(() => {
      files().showInFolder(target)
      return null
    })
  )
  ipcMain.handle('files:trash', (_event, target: string) =>
    wrap(async () => {
      await files().trash(target)
      return null
    })
  )
  ipcMain.handle('files:start-drag', (event, target: string) =>
    wrap(() => {
      const file = files().assertAllowed(target)
      event.sender.startDrag({ file, icon: dragIcon() })
      return null
    })
  )
  ipcMain.handle('files:add-recent', (_event, target: string) =>
    wrap(() => {
      files().addRecent(target)
      return null
    })
  )
  ipcMain.handle('files:recent', () => wrap(() => files().listRecent()))
  ipcMain.handle('files:open-recent', (_event, target: string) =>
    wrap(() => {
      const result = files().openRecent(target)
      rememberSystemDocument(result.path)
      if (process.platform === 'win32') {
        try {
          refreshWindowsJumpList()
        } catch {
          /* ignore */
        }
      }
      return result
    })
  )
  ipcMain.handle('files:forget', (_event, target?: string) =>
    wrap(() => {
      files().forget(target)
      syncRecentMirrors()
      return null
    })
  )
}
