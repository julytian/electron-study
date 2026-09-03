import { app } from 'electron'
import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseDeepLink, type DeepLink } from '../../shared/deep-link'
import { getMainWindow } from '../windows/main'
import { patchSettings } from './conf'
import { createSafeStorage } from './crypto'
import { getDatabase } from './db'
import { MAX_TEXT_BYTES, rememberOpened } from './files'
import { createNotesService } from './notes'
import { isMarkdownPath, noteTitleFromMarkdownPath, PROTOCOL } from './protocol-url'

export {
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
  const abs = resolve(filePath)
  const db = getDatabase()
  rememberOpened(db, abs)

  if (isMarkdownPath(abs)) {
    const size = statSync(abs).size
    if (size <= MAX_TEXT_BYTES) {
      const body = readFileSync(abs, 'utf8')
      const title = noteTitleFromMarkdownPath(abs)
      const note = createNotesService(db, createSafeStorage()).create({ title, body })
      handleDeepLinkUrl(`${PROTOCOL}://note/${note.id}`)
      return
    }
  }

  patchSettings({ ui: { lastRoute: '/workbench/files' } })
  const win = getMainWindow()
  if (!win || win.isDestroyed()) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}
