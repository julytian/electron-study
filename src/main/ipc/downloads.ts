import { desktopCapturer, ipcMain } from 'electron'
import { errorCodes, ipcError, ipcOk, type IpcResult } from '../../shared/ipc-result'
import {
  bufferFromDataUrl,
  createDownloadsService,
  writeExportFile,
  type DownloadsService
} from '../services/downloads'
import { getDatabase } from '../services/db'
import { ensureAppDirs } from '../services/paths'
import { getBrowserSession } from '../services/browser-session'
import { getMainWindow } from '../windows/main'

let downloads: DownloadsService | null = null
let listening = false

async function wrap(run: () => Promise<unknown> | unknown): Promise<IpcResult<unknown>> {
  try {
    return ipcOk(await run())
  } catch (error) {
    const name = error instanceof Error ? error.name : ''
    const message = error instanceof Error ? error.message : 'Unknown'
    if (name === 'E_NOT_FOUND') return ipcError(errorCodes.NOT_FOUND, message)
    if (name === 'E_PATH') return ipcError(errorCodes.PATH, message)
    if (name === 'E_PLATFORM') return ipcError(errorCodes.PLATFORM, message)
    if (name === 'E_VALIDATION') return ipcError(errorCodes.VALIDATION, message)
    return ipcError(errorCodes.VALIDATION, message)
  }
}

function getDownloads(): DownloadsService {
  if (!downloads) {
    downloads = createDownloadsService({
      db: getDatabase(),
      downloadsDir: ensureAppDirs().exportsDir,
      downloadURL: (url) => getBrowserSession().downloadURL(url),
      sendUpdated: (record) => {
        const win = getMainWindow()
        if (!win || win.isDestroyed()) return
        win.webContents.send('download:updated', record)
      }
    })
  }
  return downloads
}

function listenWillDownload(): void {
  if (listening) return
  listening = true
  getBrowserSession().on('will-download', (_event, item) => {
    getDownloads().handleWillDownload(item)
  })
}

export function registerDownloadsIpc(): void {
  listenWillDownload()

  ipcMain.handle('downloads:list', () => wrap(() => getDownloads().list()))
  ipcMain.handle('downloads:start', (_event, url: string) => wrap(() => getDownloads().start(url)))
  ipcMain.handle('downloads:pause', (_event, id: number) =>
    wrap(() => {
      getDownloads().pause(id)
      return null
    })
  )
  ipcMain.handle('downloads:resume', (_event, id: number) =>
    wrap(() => {
      getDownloads().resume(id)
      return null
    })
  )
  ipcMain.handle('downloads:cancel', (_event, id: number) =>
    wrap(() => {
      getDownloads().cancel(id)
      return null
    })
  )

  ipcMain.handle('print:pdf', () =>
    wrap(async () => {
      const win = getMainWindow()
      if (!win || win.isDestroyed()) {
        const error = Object.assign(new Error('主窗口不可用'), { name: 'E_PLATFORM' })
        throw error
      }
      const pdf = await win.webContents.printToPDF({})
      return { path: writeExportFile(ensureAppDirs().exportsDir, `print-${Date.now()}.pdf`, pdf) }
    })
  )

  ipcMain.handle('capture:sources', () =>
    wrap(async () => {
      const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] })
      return sources.map((source) => ({
        id: source.id,
        name: source.name,
        thumbnailDataUrl: source.thumbnail.toDataURL()
      }))
    })
  )

  ipcMain.handle('capture:save', (_event, dataUrl: string) =>
    wrap(() => {
      const { buffer, ext } = bufferFromDataUrl(dataUrl)
      return {
        path: writeExportFile(ensureAppDirs().exportsDir, `capture-${Date.now()}.${ext}`, buffer)
      }
    })
  )
}
