import { app } from 'electron'
import { existsSync } from 'node:fs'
import { getDatabase } from './db'
import { pathsForSystemRecent, type RecentRow } from './recent-sync'
import { refreshWindowsJumpList } from '../platforms/win'

export function queryRecentRows(): RecentRow[] {
  return (
    getDatabase()
      .prepare('SELECT path, opened_at AS openedAt FROM recent_files ORDER BY opened_at DESC')
      .all() as RecentRow[]
  )
}

export function purgeMissingRecentFiles(): number {
  const db = getDatabase()
  const rows = queryRecentRows()
  let removed = 0
  for (const row of rows) {
    if (existsSync(row.path)) continue
    db.prepare('DELETE FROM recent_files WHERE path = ?').run(row.path)
    removed += 1
  }
  return removed
}

export function rebuildSystemRecentDocuments(): void {
  try {
    app.clearRecentDocuments()
    for (const filePath of pathsForSystemRecent(queryRecentRows(), existsSync)) {
      app.addRecentDocument(filePath)
    }
  } catch (error) {
    // 部分平台 / 开发态可能不支持
    console.warn(error)
  }
}

export function rememberSystemDocument(filePath: string): void {
  try {
    app.addRecentDocument(filePath)
  } catch {
    // 忽略
  }
}

export function syncRecentMirrors(): void {
  rebuildSystemRecentDocuments()
  if (process.platform === 'win32') {
    try {
      refreshWindowsJumpList()
    } catch {
      // 非 Windows 或 API 失败
    }
  }
}
