import { describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { migrate } from '../src/main/services/db/migrations'
import { createNotesService, type SafeStorageLike } from '../src/main/services/notes'

function memoryDb(): Database.Database {
  const db = new Database(':memory:')
  migrate(db)
  return db
}

const stubCrypto: SafeStorageLike = {
  isEncryptionAvailable: () => true,
  encryptString: (plain) => Buffer.from(`enc:${plain}`),
  decryptString: (blob) => blob.toString().replace(/^enc:/, '')
}

describe('notes service', () => {
  it('creates and lists plaintext notes', () => {
    const notes = createNotesService(memoryDb(), stubCrypto)
    notes.create({ title: 'a', body: 'hello' })
    expect(notes.list()[0]?.body).toBe('hello')
  })

  it('stores cipher and returns decrypted body', () => {
    const db = memoryDb()
    const notes = createNotesService(db, stubCrypto)
    const created = notes.create({
      title: 's',
      body: 'secret',
      encrypted: true
    })
    const row = db.prepare('SELECT body, body_cipher FROM notes WHERE id = ?').get(created.id) as {
      body: string | null
      body_cipher: string | null
    }
    expect(row.body).toBeNull()
    expect(row.body_cipher).toContain('enc:')
    expect(notes.get(created.id).body).toBe('secret')
  })
})
