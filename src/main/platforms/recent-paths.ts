export function existingRecentPaths(
  rows: Array<{ path: string }>,
  exists: (p: string) => boolean,
  limit = 15
): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const row of rows) {
    if (result.length >= limit) break
    const filePath = row.path
    if (!filePath || seen.has(filePath) || !exists(filePath)) continue
    seen.add(filePath)
    result.push(filePath)
  }
  return result
}
