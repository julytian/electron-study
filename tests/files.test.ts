import { describe, expect, it } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import Database from 'better-sqlite3'
import { migrate } from '../src/main/services/db/migrations'
import {
  createFilesService,
  insertRecentFile,
  rememberOpened,
  type DialogLike,
  type FileShellLike
} from '../src/main/services/files'

function memoryDb(): Database.Database {
  const db = new Database(':memory:')
  migrate(db)
  return db
}

function recentPaths(db: Database.Database): string[] {
  return (
    db.prepare('SELECT path FROM recent_files ORDER BY id').all() as Array<{ path: string }>
  ).map((row) => row.path)
}

function stubDialogs(options: { open?: string | null; save?: string | null }): DialogLike {
  return {
    async showOpenDialog() {
      if (!options.open) return { canceled: true, filePaths: [] }
      return { canceled: false, filePaths: [options.open] }
    },
    async showSaveDialog() {
      if (!options.save) return { canceled: true, filePath: undefined }
      return { canceled: false, filePath: options.save }
    }
  }
}

function stubShell(): FileShellLike & { shown: string[]; trashed: string[] } {
  const shown: string[] = []
  const trashed: string[] = []
  return {
    shown,
    trashed,
    showItemInFolder(fullPath: string) {
      shown.push(fullPath)
    },
    async trashItem(fullPath: string) {
      trashed.push(fullPath)
    }
  }
}

describe('files service', () => {
  it('opens a text file, returns content, and inserts recent_files', async () => {
    const root = mkdtempSync(join(tmpdir(), 'elab-files-'))
    const userData = mkdtempSync(join(tmpdir(), 'elab-ud-'))
    const file = join(root, 'note.txt')
    writeFileSync(file, 'hello lab')
    const db = memoryDb()
    const service = createFilesService(db, userData, stubDialogs({ open: file }), stubShell())

    const result = await service.open()

    expect(result).toEqual({ path: resolve(file), content: 'hello lab' })
    expect(recentPaths(db)).toEqual([resolve(file)])
  })

  it('returns null when the open dialog is canceled', async () => {
    const userData = mkdtempSync(join(tmpdir(), 'elab-ud-'))
    const service = createFilesService(memoryDb(), userData, stubDialogs({}), stubShell())

    await expect(service.open()).resolves.toBeNull()
  })

  it('opens files larger than 2MB without reading content', async () => {
    const root = mkdtempSync(join(tmpdir(), 'elab-files-'))
    const userData = mkdtempSync(join(tmpdir(), 'elab-ud-'))
    const file = join(root, 'big.txt')
    writeFileSync(file, Buffer.alloc(2 * 1024 * 1024 + 1, 0x61))
    const service = createFilesService(
      memoryDb(),
      userData,
      stubDialogs({ open: file }),
      stubShell()
    )

    const result = await service.open()

    expect(result).toEqual({ path: resolve(file) })
    expect(result).not.toHaveProperty('content')
  })

  it('saves content, writes the file, and inserts recent_files', async () => {
    const root = mkdtempSync(join(tmpdir(), 'elab-files-'))
    const userData = mkdtempSync(join(tmpdir(), 'elab-ud-'))
    const file = join(root, 'out.txt')
    const db = memoryDb()
    const service = createFilesService(db, userData, stubDialogs({ save: file }), stubShell())

    const result = await service.save('saved body')

    expect(result).toEqual({ path: resolve(file) })
    expect(readFileSync(file, 'utf8')).toBe('saved body')
    expect(recentPaths(db)).toEqual([resolve(file)])
  })

  it('returns null when the save dialog is canceled', async () => {
    const userData = mkdtempSync(join(tmpdir(), 'elab-ud-'))
    const service = createFilesService(memoryDb(), userData, stubDialogs({}), stubShell())

    await expect(service.save('x')).resolves.toBeNull()
  })

  it('shows and trashes allowlisted paths from this session', async () => {
    const root = mkdtempSync(join(tmpdir(), 'elab-files-'))
    const userData = mkdtempSync(join(tmpdir(), 'elab-ud-'))
    const file = join(root, 'keep.txt')
    writeFileSync(file, 'keep')
    const shell = stubShell()
    const service = createFilesService(memoryDb(), userData, stubDialogs({ open: file }), shell)
    await service.open()

    service.showInFolder(file)
    await service.trash(file)

    expect(shell.shown).toEqual([resolve(file)])
    expect(shell.trashed).toEqual([resolve(file)])
  })

  it('allows userData paths even when they were not opened this session', () => {
    const userData = mkdtempSync(join(tmpdir(), 'elab-ud-'))
    const inside = join(userData, 'export.txt')
    writeFileSync(inside, 'ok')
    const service = createFilesService(memoryDb(), userData, stubDialogs({}), stubShell())

    expect(service.assertAllowed(inside)).toBe(resolve(inside))
  })

  it('rejects paths that are not on the allowlist and not inside userData', () => {
    const userData = mkdtempSync(join(tmpdir(), 'elab-ud-'))
    const outsider = join(tmpdir(), `elab-secret-${Date.now()}.txt`)
    writeFileSync(outsider, 'nope')
    const service = createFilesService(memoryDb(), userData, stubDialogs({}), stubShell())

    expect(() => service.assertAllowed(outsider)).toThrowError(/E_PATH/)
    expect(() => service.showInFolder(outsider)).toThrowError(/E_PATH/)
    expect(() => service.addRecent(outsider)).toThrowError(/E_PATH/)
  })

  it('remembers OS-opened paths without the userData jail', () => {
    const userData = mkdtempSync(join(tmpdir(), 'elab-ud-'))
    const outsider = join(tmpdir(), `elab-os-open-${Date.now()}.md`)
    writeFileSync(outsider, '# hello')
    const db = memoryDb()

    expect(rememberOpened(db, outsider)).toBe(resolve(outsider))
    expect(recentPaths(db)).toEqual([resolve(outsider)])
    expect(() =>
      createFilesService(db, userData, stubDialogs({}), stubShell()).addRecent(outsider)
    ).toThrowError(/E_PATH/)
  })

  it('adds allowlisted or userData paths to recent_files', async () => {
    const root = mkdtempSync(join(tmpdir(), 'elab-files-'))
    const userData = mkdtempSync(join(tmpdir(), 'elab-ud-'))
    const file = join(root, 'again.txt')
    writeFileSync(file, 'again')
    const db = memoryDb()
    const service = createFilesService(db, userData, stubDialogs({ open: file }), stubShell())
    await service.open()

    service.addRecent(file)

    expect(recentPaths(db)).toEqual([resolve(file)])
  })

  it('upserts the same path and updates openedAt on listRecent', async () => {
    const root = mkdtempSync(join(tmpdir(), 'elab-files-'))
    const userData = mkdtempSync(join(tmpdir(), 'elab-ud-'))
    const file = join(root, 'twice.txt')
    writeFileSync(file, 'once')
    const db = memoryDb()
    const service = createFilesService(db, userData, stubDialogs({ open: file }), stubShell())

    await service.open()
    const first = service.listRecent()
    expect(first).toHaveLength(1)
    expect(first[0].path).toBe(resolve(file))
    expect(typeof first[0].openedAt).toBe('number')

    await new Promise((resolveTimer) => setTimeout(resolveTimer, 15))
    await service.open()

    const second = service.listRecent()
    expect(second).toHaveLength(1)
    expect(second[0].path).toBe(resolve(file))
    expect(second[0].openedAt).toBeGreaterThan(first[0].openedAt)
    expect(recentPaths(db)).toEqual([resolve(file)])
  })

  it('openRecent returns content for an existing text file', async () => {
    const root = mkdtempSync(join(tmpdir(), 'elab-files-'))
    const userData = mkdtempSync(join(tmpdir(), 'elab-ud-'))
    const file = join(root, 'recent.txt')
    writeFileSync(file, 'from recent')
    const service = createFilesService(
      memoryDb(),
      userData,
      stubDialogs({ open: file }),
      stubShell()
    )
    await service.open()

    expect(service.openRecent(file)).toEqual({
      path: resolve(file),
      content: 'from recent'
    })
  })

  it('openRecent rejects a disk file that is not in recent_files and does not allowlist it', () => {
    const root = mkdtempSync(join(tmpdir(), 'elab-files-'))
    const userData = mkdtempSync(join(tmpdir(), 'elab-ud-'))
    const outsider = join(root, 'not-listed.txt')
    writeFileSync(outsider, 'exists on disk')
    const service = createFilesService(memoryDb(), userData, stubDialogs({}), stubShell())

    expect(() => service.openRecent(outsider)).toThrowError(/E_NOT_FOUND/)
    expect(() => service.assertAllowed(outsider)).toThrowError(/E_PATH/)
    expect(() => service.showInFolder(outsider)).toThrowError(/E_PATH/)
  })

  it('insertRecentFile collapses duplicate rows for the same path', () => {
    const root = mkdtempSync(join(tmpdir(), 'elab-files-'))
    const userData = mkdtempSync(join(tmpdir(), 'elab-ud-'))
    const file = join(root, 'dup.txt')
    writeFileSync(file, 'dup')
    const db = memoryDb()
    const resolved = resolve(file)
    db.prepare('INSERT INTO recent_files (path, opened_at) VALUES (?, ?)').run(resolved, 1)
    db.prepare('INSERT INTO recent_files (path, opened_at) VALUES (?, ?)').run(resolved, 2)
    expect(recentPaths(db)).toHaveLength(2)

    insertRecentFile(db, resolved)

    const listed = createFilesService(db, userData, stubDialogs({}), stubShell()).listRecent()
    expect(listed).toHaveLength(1)
    expect(listed[0].path).toBe(resolved)
    expect(recentPaths(db)).toEqual([resolved])
  })

  it('forget(path) removes that path from listRecent', async () => {
    const root = mkdtempSync(join(tmpdir(), 'elab-files-'))
    const userData = mkdtempSync(join(tmpdir(), 'elab-ud-'))
    const file = join(root, 'drop.txt')
    writeFileSync(file, 'drop me')
    const db = memoryDb()
    const service = createFilesService(db, userData, stubDialogs({ open: file }), stubShell())
    await service.open()

    service.forget(file)

    expect(service.listRecent()).toEqual([])
    expect(recentPaths(db)).toEqual([])
  })

  it('forget() with no argument clears all recent files', async () => {
    const root = mkdtempSync(join(tmpdir(), 'elab-files-'))
    const userData = mkdtempSync(join(tmpdir(), 'elab-ud-'))
    const first = join(root, 'a.txt')
    const second = join(root, 'b.txt')
    writeFileSync(first, 'a')
    const db = memoryDb()
    const service = createFilesService(
      db,
      userData,
      stubDialogs({ open: first, save: second }),
      stubShell()
    )
    await service.open()
    await service.save('b')
    expect(service.listRecent()).toHaveLength(2)

    service.forget()

    expect(service.listRecent()).toEqual([])
    expect(recentPaths(db)).toEqual([])
  })
})
