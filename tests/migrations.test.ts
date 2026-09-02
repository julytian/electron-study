import { describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { migrate } from '../src/main/services/db/migrations'

describe('migrate', () => {
  it('creates tables and sets user_version to 1', () => {
    const db = new Database(':memory:')
    migrate(db)
    const version = db.pragma('user_version', { simple: true })
    expect(version).toBe(1)
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as Array<{ name: string }>
    expect(tables.map((t) => t.name)).toEqual(
      expect.arrayContaining([
        'notes',
        'clipboard_items',
        'downloads',
        'recent_files',
        'lab_events'
      ])
    )
    db.close()
  })

  it('is idempotent', () => {
    const db = new Database(':memory:')
    migrate(db)
    migrate(db)
    expect(db.pragma('user_version', { simple: true })).toBe(1)
    db.close()
  })
})
