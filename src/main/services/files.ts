import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type Database from 'better-sqlite3'
import type { RecentFile } from '../../shared/models'
import { assertWithinRoot } from './path-jail'
import { RECENT_FILE_LIMIT } from './recent-sync'

export const MAX_TEXT_BYTES = 2 * 1024 * 1024

export function insertRecentFile(db: Database.Database, filePath: string): void {
  const now = Date.now()
  const existing = db.prepare('SELECT id FROM recent_files WHERE path = ?').get(filePath) as
    | { id: number }
    | undefined
  if (existing) {
    db.prepare('UPDATE recent_files SET opened_at = ? WHERE id = ?').run(now, existing.id)
    db.prepare('DELETE FROM recent_files WHERE path = ? AND id != ?').run(filePath, existing.id)
    return
  }
  db.prepare('INSERT INTO recent_files (path, opened_at) VALUES (?, ?)').run(filePath, now)
}

export function rememberOpened(db: Database.Database, absPath: string): string {
  const resolved = resolve(absPath)
  insertRecentFile(db, resolved)
  return resolved
}

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

function notFoundError(message: string): Error {
  return Object.assign(new Error(message), { name: 'E_NOT_FOUND' })
}

function readIfText(filePath: string): { path: string; content?: string } {
  const size = statSync(filePath).size
  if (size > MAX_TEXT_BYTES) return { path: filePath }
  return { path: filePath, content: readFileSync(filePath, 'utf8') }
}

export interface FilesService {
  open(): Promise<{ path: string; content?: string } | null>
  save(content: string): Promise<{ path: string } | null>
  showInFolder(target: string): void
  trash(target: string): Promise<void>
  addRecent(target: string): void
  assertAllowed(target: string): string
  listRecent(): RecentFile[]
  openRecent(target: string): { path: string; content?: string }
  forget(target?: string): void
}

export function createFilesService(
  db: Database.Database,
  userData: string,
  dialogs: DialogLike,
  fileShell: FileShellLike,
  allowlist: Set<string> = new Set()
): FilesService {
  function insertRecent(filePath: string): void {
    insertRecentFile(db, filePath)
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
      return readIfText(filePath)
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
    assertAllowed,
    listRecent() {
      const rows = db
        .prepare('SELECT id, path, opened_at FROM recent_files ORDER BY opened_at DESC')
        .all() as Array<{ id: number; path: string; opened_at: number }>
      return rows
        .filter((row) => existsSync(row.path))
        .map((row) => ({ id: row.id, path: row.path, openedAt: row.opened_at }))
        .slice(0, RECENT_FILE_LIMIT)
    },
    openRecent(target: string) {
      const filePath = resolve(target)
      const row = db.prepare('SELECT id FROM recent_files WHERE path = ?').get(filePath) as
        | { id: number }
        | undefined
      if (!row) {
        throw notFoundError('E_NOT_FOUND: Recent file is missing')
      }
      if (!existsSync(filePath)) {
        db.prepare('DELETE FROM recent_files WHERE path = ?').run(filePath)
        throw notFoundError('E_NOT_FOUND: Recent file is missing')
      }
      insertRecent(filePath)
      allowlist.add(filePath)
      return readIfText(filePath)
    },
    forget(target?: string) {
      if (target === undefined) {
        db.prepare('DELETE FROM recent_files').run()
        return
      }
      const filePath = resolve(target)
      db.prepare('DELETE FROM recent_files WHERE path = ?').run(filePath)
      allowlist.delete(filePath)
    }
  }
}
