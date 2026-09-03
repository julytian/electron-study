import type Database from 'better-sqlite3'
import type { Note } from '../../shared/models'

export interface SafeStorageLike {
  isEncryptionAvailable(): boolean
  encryptString(plain: string): Buffer
  decryptString(blob: Buffer): string
}

interface NoteRow {
  id: number
  title: string
  body: string | null
  body_cipher: string | null
  is_encrypted: number
  pinned: number
  created_at: number
  updated_at: number
}

function encryptError(message: string): Error {
  return Object.assign(new Error(message), { name: 'E_ENCRYPT' })
}

function notFoundError(): Error {
  return Object.assign(new Error('Note not found'), { name: 'E_NOT_FOUND' })
}

export interface NotesService {
  list(query?: string): Note[]
  get(id: number): Note
  create(input: { title: string; body: string; encrypted?: boolean }): Note
  update(input: {
    id: number
    title?: string
    body?: string
    pinned?: boolean
    encrypted?: boolean
  }): Note
  delete(id: number): void
}

export function createNotesService(db: Database.Database, crypto: SafeStorageLike): NotesService {
  function encodeCipher(plain: string): string {
    return crypto.encryptString(plain).toString('base64')
  }

  function decodeCipher(stored: string): string {
    return crypto.decryptString(Buffer.from(stored, 'base64'))
  }

  function decode(row: NoteRow): Note {
    let body = row.body ?? ''
    if (row.is_encrypted) {
      if (!row.body_cipher) throw encryptError('Missing cipher')
      body = decodeCipher(row.body_cipher)
    }
    return {
      id: row.id,
      title: row.title,
      body,
      isEncrypted: Boolean(row.is_encrypted),
      pinned: Boolean(row.pinned),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }

  function requireEncryption(): void {
    if (!crypto.isEncryptionAvailable()) {
      throw encryptError('Encryption unavailable')
    }
  }

  return {
    list(query?: string): Note[] {
      const rows = query
        ? (db
            .prepare(
              'SELECT * FROM notes WHERE title LIKE ? OR ifnull(body, "") LIKE ? ORDER BY pinned DESC, updated_at DESC'
            )
            .all(`%${query}%`, `%${query}%`) as NoteRow[])
        : (db
            .prepare('SELECT * FROM notes ORDER BY pinned DESC, updated_at DESC')
            .all() as NoteRow[])
      return rows.map((row) => {
        try {
          return decode(row)
        } catch {
          return {
            ...decode({ ...row, is_encrypted: 0, body: '', body_cipher: null }),
            body: '（无法解密）'
          }
        }
      })
    },
    get(id: number): Note {
      const row = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as NoteRow | undefined
      if (!row) throw notFoundError()
      return decode(row)
    },
    create(input: { title: string; body: string; encrypted?: boolean }): Note {
      const now = Date.now()
      let body: string | null = input.body
      let cipher: string | null = null
      let encrypted = 0
      if (input.encrypted) {
        requireEncryption()
        cipher = encodeCipher(input.body)
        body = null
        encrypted = 1
      }
      const result = db
        .prepare(
          'INSERT INTO notes (title, body, body_cipher, is_encrypted, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)'
        )
        .run(input.title, body, cipher, encrypted, now, now)
      return this.get(Number(result.lastInsertRowid))
    },
    update(input: {
      id: number
      title?: string
      body?: string
      pinned?: boolean
      encrypted?: boolean
    }): Note {
      const current = this.get(input.id)
      const title = input.title ?? current.title
      const nextBody = input.body ?? current.body
      const pinned = input.pinned ?? current.pinned
      const encrypted = input.encrypted ?? current.isEncrypted
      let body: string | null = nextBody
      let cipher: string | null = null
      if (encrypted) {
        requireEncryption()
        cipher = encodeCipher(nextBody)
        body = null
      }
      db.prepare(
        'UPDATE notes SET title=?, body=?, body_cipher=?, is_encrypted=?, pinned=?, updated_at=? WHERE id=?'
      ).run(title, body, cipher, encrypted ? 1 : 0, pinned ? 1 : 0, Date.now(), input.id)
      return this.get(input.id)
    },
    delete(id: number): void {
      const result = db.prepare('DELETE FROM notes WHERE id = ?').run(id)
      if (result.changes === 0) throw notFoundError()
    }
  }
}
