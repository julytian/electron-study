import type Database from 'better-sqlite3'

const VERSION = 1

const V1 = `
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT,
  body_cipher TEXT,
  is_encrypted INTEGER NOT NULL DEFAULT 0,
  pinned INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS clipboard_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  text TEXT,
  html TEXT,
  image_path TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS downloads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  filename TEXT NOT NULL,
  save_path TEXT NOT NULL,
  state TEXT NOT NULL,
  received INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  finished_at INTEGER
);
CREATE TABLE IF NOT EXISTS recent_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL,
  opened_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS lab_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  ok INTEGER NOT NULL,
  message TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
`

export function migrate(db: Database.Database): void {
  const current = Number(db.pragma('user_version', { simple: true }))
  if (current >= VERSION) return
  db.exec(V1)
  db.pragma(`user_version = ${VERSION}`)
}
