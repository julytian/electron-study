export const LIST_PROCESS_EVENTS_SQL =
  "SELECT * FROM lab_events WHERE module = 'process' ORDER BY created_at DESC LIMIT ?"

export interface LabEventRowLike {
  module: string
  action: string
  ok: boolean
  message: string
  createdAt: number
}

export function formatRecentProcessEvents(rows: LabEventRowLike[], limit = 10): string {
  const processRows = rows
    .filter((row) => row.module === 'process')
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, limit)
  if (processRows.length === 0) return '暂无进程事件'
  return processRows.map((row) => `${row.action} ok=${row.ok} ${row.message}`).join('; ')
}
