import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type Database from 'better-sqlite3'
import { assertWithinRoot } from './path-jail'

export const MAX_TEXT_BYTES = 2 * 1024 * 1024

export interface DialogLike {
  showOpenDialog(options?: {
    properties?: Array<'openFile' | 'openDirectory' | 'multiSelections'>
  }): Promise<{ canceled: boolean; filePaths: string[] }>
  showSaveDialog(options?: { defaultPath?: string }): Promise<{
    canceled: boolean
    filePath?: string
  }>
}

export interface FileShellLike {
  showItemInFolder(fullPath: string): void
  trashItem(fullPath: string): Promise<void>
}

function pathError(message: string): Error {
  return Object.assign(new Error(message), { name: 'E_PATH' })
}

export interface FilesService {
  open(): Promise<{ path: string; content?: string } | null>
  save(content: string): Promise<{ path: string } | null>
  showInFolder(target: string): void
  trash(target: string): Promise<void>
  addRecent(target: string): void
  assertAllowed(target: string): string
}

export function createFilesService(
  db: Database.Database,
  userData: string,
  dialogs: DialogLike,
  fileShell: FileShellLike,
  allowlist: Set<string> = new Set()
): FilesService {
  function insertRecent(filePath: string): void {
    db.prepare('INSERT INTO recent_files (path, opened_at) VALUES (?, ?)').run(filePath, Date.now())
  }

  function remember(filePath: string): string {
    const resolved = resolve(filePath)
    allowlist.add(resolved)
    insertRecent(resolved)
    return resolved
  }

  function assertAllowed(target: string): string {
    const resolved = resolve(target)
    if (allowlist.has(resolved)) return resolved
    try {
      return assertWithinRoot(resolved, userData)
    } catch {
      throw pathError('E_PATH: Path is not allowed')
    }
  }

  return {
    async open() {
      const result = await dialogs.showOpenDialog({ properties: ['openFile'] })
      if (result.canceled || !result.filePaths[0]) return null
      const filePath = remember(result.filePaths[0])
      const size = statSync(filePath).size
      if (size > MAX_TEXT_BYTES) return { path: filePath }
      return { path: filePath, content: readFileSync(filePath, 'utf8') }
    },
    async save(content: string) {
      const result = await dialogs.showSaveDialog({})
      if (result.canceled || !result.filePath) return null
      const filePath = resolve(result.filePath)
      writeFileSync(filePath, content, 'utf8')
      remember(filePath)
      return { path: filePath }
    },
    showInFolder(target: string) {
      fileShell.showItemInFolder(assertAllowed(target))
    },
    async trash(target: string) {
      await fileShell.trashItem(assertAllowed(target))
    },
    addRecent(target: string) {
      insertRecent(assertAllowed(target))
    },
    assertAllowed
  }
}
