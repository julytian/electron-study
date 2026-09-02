import Database from 'better-sqlite3'
import { migrate } from './migrations'
import { ensureAppDirs } from '../paths'

let db: Database.Database | null = null

export function openDatabase(): Database.Database {
  if (db) return db
  const { dbFile } = ensureAppDirs()
  db = new Database(dbFile)
  db.pragma('journal_mode = WAL')
  migrate(db)
  return db
}

export function getDatabase(): Database.Database {
  if (!db) throw new Error('Database not opened')
  return db
}

export function closeDatabase(): void {
  db?.close()
  db = null
}

export function clearBusinessTables(): void {
  const conn = getDatabase()
  conn.exec(
    'DELETE FROM notes; DELETE FROM clipboard_items; DELETE FROM downloads; DELETE FROM recent_files; DELETE FROM lab_events;'
  )
}
