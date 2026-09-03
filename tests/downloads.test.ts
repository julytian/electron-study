import { describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import Database from 'better-sqlite3'
import { migrate } from '../src/main/services/db/migrations'
import {
  assertHttpsDownloadUrl,
  bufferFromDataUrl,
  createDownloadsService,
  type DownloadItemLike,
  writeExportFile
} from '../src/main/services/downloads'

function memoryDb(): Database.Database {
  const db = new Database(':memory:')
  migrate(db)
  return db
}

function stubItem(
  overrides: Partial<DownloadItemLike> & { url?: string; filename?: string } = {}
): DownloadItemLike & {
  savePath: string
  paused: boolean
  state: string
  received: number
  total: number
  updated: Array<() => void>
  done: Array<() => void>
} {
  const state = {
    url: overrides.url ?? overrides.getURL?.() ?? 'https://example.com/file.bin',
    filename: overrides.filename ?? 'file.bin',
    savePath: '',
    paused: false,
    state: 'progressing',
    received: 10,
    total: 100,
    updated: [] as Array<() => void>,
    done: [] as Array<() => void>
  }
  const item: DownloadItemLike & typeof state = {
    ...state,
    getURL: () => item.url,
    getFilename: () => item.filename,
    getSavePath: () => item.savePath,
    getReceivedBytes: () => item.received,
    getTotalBytes: () => item.total,
    getState: () => item.state,
    isPaused: () => item.paused,
    setSavePath(path: string) {
      state.savePath = path
      item.savePath = path
    },
    pause() {
      state.paused = true
      item.paused = true
    },
    resume() {
      state.paused = false
      item.paused = false
    },
    cancel() {
      state.state = 'cancelled'
      item.state = 'cancelled'
    },
    on(event, listener) {
      if (event === 'updated') state.updated.push(listener)
      else state.done.push(listener)
    }
  }
  return Object.assign(item, state)
}

describe('assertHttpsDownloadUrl', () => {
  it('keeps an https URL', () => {
    expect(assertHttpsDownloadUrl('https://example.com/a.bin')).toBe('https://example.com/a.bin')
  })

  it('rejects http, file, javascript and empty input', () => {
    expect(() => assertHttpsDownloadUrl('http://insecure.local/a')).toThrowError(
      /E_VALIDATION|https/
    )
    expect(() => assertHttpsDownloadUrl('file:///etc/passwd')).toThrowError(/E_VALIDATION|https/)
    expect(() => assertHttpsDownloadUrl('javascript:alert(1)')).toThrowError(/E_VALIDATION|https/)
    expect(() => assertHttpsDownloadUrl('   ')).toThrowError(/E_VALIDATION|空/)
  })
})

describe('downloads service', () => {
  it('lists records newest first', () => {
    const dir = mkdtempSync(join(tmpdir(), 'elab-dl-'))
    const started: string[] = []
    const service = createDownloadsService({
      db: memoryDb(),
      downloadsDir: dir,
      downloadURL: (url) => started.push(url),
      now: (() => {
        let t = 1000
        return () => (t += 1)
      })()
    })

    service.start('https://example.com/one.bin')
    service.start('https://example.com/two.bin')

    expect(service.list().map((row) => row.url)).toEqual([
      'https://example.com/two.bin',
      'https://example.com/one.bin'
    ])
  })

  it('rejects non-https start without calling downloadURL', () => {
    const started: string[] = []
    const service = createDownloadsService({
      db: memoryDb(),
      downloadsDir: mkdtempSync(join(tmpdir(), 'elab-dl-')),
      downloadURL: (url) => started.push(url)
    })

    expect(() => service.start('http://insecure.local/a')).toThrowError(/E_VALIDATION|https/)
    expect(started).toEqual([])
    expect(service.list()).toEqual([])
  })

  it('starts an https download, persists a progressing record, and calls downloadURL', () => {
    const started: string[] = []
    const service = createDownloadsService({
      db: memoryDb(),
      downloadsDir: mkdtempSync(join(tmpdir(), 'elab-dl-')),
      downloadURL: (url) => started.push(url),
      now: () => 1700000000000
    })

    const record = service.start('https://example.com/file.bin')

    expect(started).toEqual(['https://example.com/file.bin'])
    expect(record.url).toBe('https://example.com/file.bin')
    expect(record.filename).toBe('file.bin')
    expect(record.state).toBe('progressing')
    expect(record.received).toBe(0)
    expect(record.total).toBe(0)
    expect(record.createdAt).toBe(1700000000000)
    expect(record.finishedAt).toBeNull()
    expect(service.list()).toHaveLength(1)
  })

  it('binds will-download to the pending start, jails the save path, and emits updates', () => {
    const dir = mkdtempSync(join(tmpdir(), 'elab-dl-'))
    const updates: string[] = []
    const service = createDownloadsService({
      db: memoryDb(),
      downloadsDir: dir,
      downloadURL: () => undefined,
      now: () => 1700000000000,
      sendUpdated: (record) => updates.push(`${record.id}:${record.state}:${record.received}`)
    })
    const started = service.start('https://example.com/file.bin')
    const item = stubItem({ url: 'https://example.com/file.bin', filename: 'file.bin' })

    const bound = service.handleWillDownload(item)

    expect(bound.id).toBe(started.id)
    expect(item.savePath.startsWith(resolve(dir))).toBe(true)
    expect(existsSync(item.savePath) || item.savePath.includes('file.bin')).toBe(true)
    expect(bound.savePath).toBe(item.savePath)
    expect(bound.filename).toBe('file.bin')
    expect(bound.received).toBe(10)
    expect(bound.total).toBe(100)
    expect(updates.at(-1)).toBe(`${started.id}:progressing:10`)

    item.received = 80
    item.updated[0]?.()
    expect(service.list()[0]?.received).toBe(80)

    item.state = 'completed'
    item.received = 100
    item.done[0]?.()
    const done = service.list()[0]
    expect(done?.state).toBe('completed')
    expect(done?.finishedAt).toBe(1700000000000)
    expect(updates.at(-1)).toBe(`${started.id}:completed:100`)
  })

  it('creates a new record when the browser starts a download without start()', () => {
    const service = createDownloadsService({
      db: memoryDb(),
      downloadsDir: mkdtempSync(join(tmpdir(), 'elab-dl-')),
      downloadURL: () => undefined
    })
    const item = stubItem({ url: 'https://cdn.example/app.zip', filename: 'app.zip' })

    const record = service.handleWillDownload(item)

    expect(record.url).toBe('https://cdn.example/app.zip')
    expect(record.filename).toBe('app.zip')
    expect(service.list()).toHaveLength(1)
  })

  it('pauses, resumes and cancels a tracked item', () => {
    const service = createDownloadsService({
      db: memoryDb(),
      downloadsDir: mkdtempSync(join(tmpdir(), 'elab-dl-')),
      downloadURL: () => undefined
    })
    const started = service.start('https://example.com/file.bin')
    const item = stubItem({ url: 'https://example.com/file.bin' })
    service.handleWillDownload(item)

    service.pause(started.id)
    expect(item.paused).toBe(true)
    expect(service.list()[0]?.state).toBe('paused')

    service.resume(started.id)
    expect(item.paused).toBe(false)
    expect(service.list()[0]?.state).toBe('progressing')

    service.cancel(started.id)
    expect(item.state).toBe('cancelled')
    expect(service.list()[0]?.state).toBe('cancelled')
    expect(service.list()[0]?.finishedAt).not.toBeNull()
  })

  it('throws E_NOT_FOUND when pause/resume/cancel have no live item', () => {
    const service = createDownloadsService({
      db: memoryDb(),
      downloadsDir: mkdtempSync(join(tmpdir(), 'elab-dl-')),
      downloadURL: () => undefined
    })

    expect(() => service.pause(99)).toThrowError(/E_NOT_FOUND|不存在/)
    expect(() => service.resume(99)).toThrowError(/E_NOT_FOUND|不存在/)
    expect(() => service.cancel(99)).toThrowError(/E_NOT_FOUND|不存在/)
  })
})

describe('export writers', () => {
  it('writes a file inside exportsDir after path-jail', () => {
    const dir = mkdtempSync(join(tmpdir(), 'elab-ex-'))
    const path = writeExportFile(dir, 'out.pdf', Buffer.from('%PDF'))

    expect(path.startsWith(resolve(dir))).toBe(true)
    expect(readFileSync(path)).toEqual(Buffer.from('%PDF'))
  })

  it('rejects a filename that escapes exportsDir', () => {
    const dir = mkdtempSync(join(tmpdir(), 'elab-ex-'))
    expect(() => writeExportFile(dir, '../secret.pdf', Buffer.from('x'))).toThrowError(/E_PATH/)
  })

  it('decodes a png data URL and rejects invalid input', () => {
    const png = Buffer.from('png-bytes')
    const decoded = bufferFromDataUrl(`data:image/png;base64,${png.toString('base64')}`)
    expect(decoded.ext).toBe('png')
    expect(decoded.buffer).toEqual(png)
    expect(() => bufferFromDataUrl('not-a-data-url')).toThrowError(/截图数据无效/)
  })
})
