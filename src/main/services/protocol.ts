import { app } from 'electron'
import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseDeepLink, type DeepLink } from '../../shared/deep-link'
import { refreshWindowsJumpList } from '../platforms/win'
import { getMainWindow } from '../windows/main'
import { processAssociatedFileContent } from './associated-file'
import { patchSettings } from './conf'
import { createSafeStorage } from './crypto'
import { getDatabase } from './db'
import { rememberOpened } from './files'
import { createNotesService } from './notes'
import { rememberSystemDocument } from './recent-documents'
import { PROTOCOL } from './protocol-url'

export {
  extractFileFromArgv,
  extractUrlFromArgv,
  isMarkdownPath,
  noteTitleFromMarkdownPath,
  PROTOCOL
} from './protocol-url'

let queuedDeepLink: DeepLink | null = null
const pendingOpenFiles: string[] = []

export function registerProtocol(): boolean {
  if (process.defaultApp && process.argv.length >= 2) {
    return app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [resolve(process.argv[1])])
  }
  return app.setAsDefaultProtocolClient(PROTOCOL)
}

export function handleDeepLinkUrl(url: string): boolean {
  const payload = parseDeepLink(url)
  if (!payload) return false
  patchSettings({ ui: { lastRoute: `/workbench/notes?id=${payload.id}` } })
  dispatchDeepLink(payload)
  return true
}

export function flushDeepLinkQueue(): void {
  if (!queuedDeepLink) return
  dispatchDeepLink(queuedDeepLink)
}

export function handleOpenFile(filePath: string): void {
  try {
    getDatabase()
  } catch {
    pendingOpenFiles.push(filePath)
    return
  }
  try {
    processAssociatedFile(filePath)
  } catch {
    // 关联文件可能已被删除或不可读
  }
}

export function flushPendingOpenFiles(): void {
  const files = pendingOpenFiles.splice(0, pendingOpenFiles.length)
  for (const file of files) handleOpenFile(file)
}

function dispatchDeepLink(payload: DeepLink): void {
  const win = getMainWindow()
  if (!win || win.isDestroyed()) {
    queuedDeepLink = payload
    return
  }
  if (win.webContents.isLoading()) {
    queuedDeepLink = payload
    win.webContents.once('did-finish-load', () => {
      if (!queuedDeepLink) return
      const next = queuedDeepLink
      queuedDeepLink = null
      sendDeepLink(next)
    })
    return
  }
  queuedDeepLink = null
  sendDeepLink(payload)
}

function sendDeepLink(payload: DeepLink): void {
  const win = getMainWindow()
  if (!win || win.isDestroyed()) {
    queuedDeepLink = payload
    return
  }
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
  win.webContents.send('deep-link:open', payload)
}

function processAssociatedFile(filePath: string): void {
  const db = getDatabase()
  const notes = createNotesService(db, createSafeStorage())
  const result = processAssociatedFileContent(filePath, {
    remember: (absPath) => {
      const path = rememberOpened(db, absPath)
      rememberSystemDocument(path)
      if (process.platform === 'win32') {
        try {
          refreshWindowsJumpList()
        } catch {
          /* ignore */
        }
      }
      return path
    },
    fs: {
      statSize: (target) => statSync(target).size,
      readText: (target) => readFileSync(target, 'utf8')
    },
    notes
  })

  if (result.kind === 'note') {
    handleDeepLinkUrl(`${PROTOCOL}://note/${result.id}`)
    return
  }

  patchSettings({ ui: { lastRoute: '/workbench/files' } })
  const win = getMainWindow()
  if (!win || win.isDestroyed()) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}
