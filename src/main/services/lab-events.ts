import type { LabEvent } from '../../shared/models'
import { formatRecentProcessEvents } from '../../shared/lab-event-format'
import { getDatabase } from './db'

export function recordLabEvent(
  module: string,
  action: string,
  ok: boolean,
  message: string
): void {
  try {
    getDatabase()
      .prepare(
        'INSERT INTO lab_events (module, action, ok, message, created_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(module, action, ok ? 1 : 0, message, Date.now())
  } catch {
    // 记录失败不影响实验室动作或进程恢复
  }
}

export function listLabEvents(limit = 50): LabEvent[] {
  const rows = getDatabase()
    .prepare('SELECT * FROM lab_events ORDER BY created_at DESC LIMIT ?')
    .all(limit) as Array<{
    id: number
    module: string
    action: string
    ok: number
    message: string
    created_at: number
  }>
  return rows.map((row) => ({
    id: row.id,
    module: row.module,
    action: row.action,
    ok: Boolean(row.ok),
    message: row.message,
    createdAt: row.created_at
  }))
}

export function recentProcessEventsMessage(limit = 10): string {
  return formatRecentProcessEvents(listLabEvents(50), limit)
}
