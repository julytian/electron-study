import type Database from 'better-sqlite3'

export const RECENT_FILE_LIMIT = 15

export interface RecentRow {
  path: string
  openedAt: number
}

export function dedupeRecentRows<T extends RecentRow>(rows: T[]): T[] {
  const newest = new Map<string, T>()
  for (const row of rows) {
    const current = newest.get(row.path)
    if (!current || row.openedAt > current.openedAt) newest.set(row.path, row)
  }
  return [...newest.values()].sort((a, b) => b.openedAt - a.openedAt)
}

export function collapseDuplicateRecentRows(db: Database.Database): number {
  const rows = db.prepare('SELECT id, path, opened_at FROM recent_files').all() as Array<{
    id: number
    path: string
    opened_at: number
  }>
  const keepByPath = new Map<string, { id: number; opened_at: number }>()
  for (const row of rows) {
    const current = keepByPath.get(row.path)
    if (!current || row.opened_at > current.opened_at) keepByPath.set(row.path, row)
  }
  const keep = new Set([...keepByPath.values()].map((row) => row.id))
  let removed = 0
  for (const row of rows) {
    if (keep.has(row.id)) continue
    db.prepare('DELETE FROM recent_files WHERE id = ?').run(row.id)
    removed += 1
  }
  return removed
}

export function filterExistingPaths(paths: string[], exists: (p: string) => boolean): string[] {
  return paths.filter((p) => p && exists(p))
}

export function pathsForSystemRecent(
  rows: RecentRow[],
  exists: (p: string) => boolean
): string[] {
  return filterExistingPaths(
    dedupeRecentRows(rows).map((row) => row.path),
    exists
  ).slice(0, RECENT_FILE_LIMIT)
}

export function pathsForAddRecentDocument(
  rows: RecentRow[],
  exists: (p: string) => boolean
): string[] {
  return pathsForSystemRecent(rows, exists).slice().reverse()
}
