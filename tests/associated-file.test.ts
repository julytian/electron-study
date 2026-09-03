import { describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import Database from 'better-sqlite3'
import { migrate } from '../src/main/services/db/migrations'
import { MAX_TEXT_BYTES, rememberOpened } from '../src/main/services/files'
import { createNotesService, type SafeStorageLike } from '../src/main/services/notes'
import { processAssociatedFileContent } from '../src/main/services/associated-file'

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

function recentPaths(db: Database.Database): string[] {
  return (
    db.prepare('SELECT path FROM recent_files ORDER BY id').all() as Array<{ path: string }>
  ).map((row) => row.path)
}

function processRealFile(db: Database.Database, filePath: string) {
  const notes = createNotesService(db, stubCrypto)
  return processAssociatedFileContent(filePath, {
    remember: (absPath) => rememberOpened(db, absPath),
    fs: {
      statSize: (target) => statSync(target).size,
      readText: (target) => readFileSync(target, 'utf8')
    },
    notes: {
      create: (input) => notes.create(input)
    }
  })
}

describe('processAssociatedFileContent', () => {
  it('creates a note from a small markdown file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'elab-assoc-'))
    const file = join(dir, 'Meeting Notes.md')
    writeFileSync(file, '# hello lab')
    const db = memoryDb()

    const result = processRealFile(db, file)

    expect(result).toEqual({ kind: 'note', path: resolve(file), id: expect.any(Number) })
    if (result.kind !== 'note') throw new Error('expected note')
    const notes = createNotesService(db, stubCrypto)
    expect(notes.get(result.id)).toMatchObject({
      title: 'Meeting Notes',
      body: '# hello lab'
    })
    expect(recentPaths(db)).toEqual([resolve(file)])
  })

  it('does not create a note for an oversized markdown file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'elab-assoc-'))
    const file = join(dir, 'huge.md')
    writeFileSync(file, Buffer.alloc(MAX_TEXT_BYTES + 1, 0x61))
    const db = memoryDb()

    const result = processRealFile(db, file)

    expect(result).toEqual({ kind: 'recent', path: resolve(file) })
    expect(createNotesService(db, stubCrypto).list()).toEqual([])
    expect(recentPaths(db)).toEqual([resolve(file)])
  })

  it('only records recent_files for a non-markdown file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'elab-assoc-'))
    const file = join(dir, 'photo.png')
    writeFileSync(file, Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    const db = memoryDb()

    const result = processRealFile(db, file)

    expect(result).toEqual({ kind: 'recent', path: resolve(file) })
    expect(createNotesService(db, stubCrypto).list()).toEqual([])
    expect(recentPaths(db)).toEqual([resolve(file)])
  })
})
