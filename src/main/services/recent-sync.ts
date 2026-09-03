export const RECENT_FILE_LIMIT = 15

export interface RecentRow {
  path: string
  openedAt: number
}

export function dedupeRecentRows(rows: RecentRow[]): RecentRow[] {
  const newest = new Map<string, RecentRow>()
  for (const row of rows) {
    const current = newest.get(row.path)
    if (!current || row.openedAt > current.openedAt) newest.set(row.path, row)
  }
  return [...newest.values()].sort((a, b) => b.openedAt - a.openedAt)
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
