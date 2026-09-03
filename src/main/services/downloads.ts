import { writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import type Database from 'better-sqlite3'
import type { DownloadRecord, DownloadState } from '../../shared/models'
import { assertWithinRoot } from './path-jail'

export interface DownloadItemLike {
  getURL(): string
  getFilename(): string
  getSavePath(): string
  getReceivedBytes(): number
  getTotalBytes(): number
  getState(): string
  isPaused(): boolean
  setSavePath(path: string): void
  pause(): void
  resume(): void
  cancel(): void
  on(event: 'updated' | 'done', listener: () => void): void
}

export interface DownloadsService {
  list(): DownloadRecord[]
  start(url: string): DownloadRecord
  pause(id: number): void
  resume(id: number): void
  cancel(id: number): void
  handleWillDownload(item: DownloadItemLike): DownloadRecord
}

interface DownloadRow {
  id: number
  url: string
  filename: string
  save_path: string
  state: DownloadState
  received: number
  total: number
  created_at: number
  finished_at: number | null
}

function validationError(message: string): Error {
  return Object.assign(new Error(message), { name: 'E_VALIDATION' })
}

function notFoundError(message = '下载任务不存在'): Error {
  return Object.assign(new Error(message), { name: 'E_NOT_FOUND' })
}

export function assertHttpsDownloadUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) throw validationError('URL 不能为空')
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw validationError('URL 无效')
  }
  if (parsed.protocol !== 'https:') {
    throw validationError('仅允许 https 地址')
  }
  return parsed.href
}

export function filenameFromUrl(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() || '')
    return sanitizeFilename(name)
  } catch {
    return 'download'
  }
}

export function sanitizeFilename(name: string): string {
  const base = basename(name)
    .split('')
    .map((char) => (char.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(char) ? '_' : char))
    .join('')
  return base || 'download'
}

export function mapDownloadState(item: { getState(): string; isPaused(): boolean }): DownloadState {
  if (item.isPaused()) return 'paused'
  const state = item.getState()
  if (
    state === 'progressing' ||
    state === 'completed' ||
    state === 'cancelled' ||
    state === 'interrupted'
  ) {
    return state
  }
  return 'interrupted'
}

function decode(row: DownloadRow): DownloadRecord {
  return {
    id: row.id,
    url: row.url,
    filename: row.filename,
    savePath: row.save_path,
    state: row.state,
    received: row.received,
    total: row.total,
    createdAt: row.created_at,
    finishedAt: row.finished_at
  }
}

export function writeExportFile(exportsDir: string, filename: string, data: Buffer): string {
  const target = assertWithinRoot(join(exportsDir, filename), exportsDir)
  writeFileSync(target, data)
  return target
}

export function bufferFromDataUrl(dataUrl: string): { buffer: Buffer; ext: string } {
  const match = /^data:image\/([\w+.-]+);base64,(.+)$/.exec(dataUrl.trim())
  if (!match?.[1] || !match[2]) {
    throw validationError('截图数据无效')
  }
  const rawExt = match[1].toLowerCase()
  const ext = rawExt === 'jpeg' ? 'jpg' : rawExt.replace(/[^a-z0-9]/g, '') || 'png'
  return { buffer: Buffer.from(match[2], 'base64'), ext }
}

export function createDownloadsService(deps: {
  db: Database.Database
  downloadsDir: string
  downloadURL: (url: string) => void
  now?: () => number
  sendUpdated?: (record: DownloadRecord) => void
}): DownloadsService {
  const items = new Map<number, DownloadItemLike>()
  const now = deps.now ?? Date.now

  function getRow(id: number): DownloadRow {
    const row = deps.db.prepare('SELECT * FROM downloads WHERE id = ?').get(id) as
      DownloadRow | undefined
    if (!row) throw notFoundError()
    return row
  }

  function emit(record: DownloadRecord): DownloadRecord {
    deps.sendUpdated?.(record)
    return record
  }

  function persist(id: number, patch: Partial<DownloadRow>): DownloadRecord {
    const current = getRow(id)
    const next = {
      filename: patch.filename ?? current.filename,
      save_path: patch.save_path ?? current.save_path,
      state: patch.state ?? current.state,
      received: patch.received ?? current.received,
      total: patch.total ?? current.total,
      finished_at: patch.finished_at === undefined ? current.finished_at : patch.finished_at
    }
    deps.db
      .prepare(
        'UPDATE downloads SET filename=?, save_path=?, state=?, received=?, total=?, finished_at=? WHERE id=?'
      )
      .run(
        next.filename,
        next.save_path,
        next.state,
        next.received,
        next.total,
        next.finished_at,
        id
      )
    return emit(decode(getRow(id)))
  }

  function insert(input: {
    url: string
    filename: string
    savePath: string
    state: DownloadState
    received: number
    total: number
    finishedAt: number | null
  }): DownloadRecord {
    const createdAt = now()
    const result = deps.db
      .prepare(
        'INSERT INTO downloads (url, filename, save_path, state, received, total, created_at, finished_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        input.url,
        input.filename,
        input.savePath,
        input.state,
        input.received,
        input.total,
        createdAt,
        input.finishedAt
      )
    return decode(getRow(Number(result.lastInsertRowid)))
  }

  function snapshot(id: number, item: DownloadItemLike): DownloadRecord {
    const state = mapDownloadState(item)
    const finished =
      state === 'completed' || state === 'cancelled' || state === 'interrupted' ? now() : null
    return persist(id, {
      filename: sanitizeFilename(item.getFilename() || filenameFromUrl(item.getURL())),
      save_path: item.getSavePath(),
      state,
      received: item.getReceivedBytes(),
      total: item.getTotalBytes(),
      finished_at: finished
    })
  }

  function requireItem(id: number): DownloadItemLike {
    const item = items.get(id)
    if (!item) throw notFoundError()
    return item
  }

  return {
    list() {
      const rows = deps.db
        .prepare('SELECT * FROM downloads ORDER BY created_at DESC, id DESC')
        .all() as DownloadRow[]
      return rows.map(decode)
    },
    start(url: string) {
      const href = assertHttpsDownloadUrl(url)
      const record = insert({
        url: href,
        filename: filenameFromUrl(href),
        savePath: '',
        state: 'progressing',
        received: 0,
        total: 0,
        finishedAt: null
      })
      deps.downloadURL(href)
      return record
    },
    pause(id: number) {
      const item = requireItem(id)
      item.pause()
      snapshot(id, item)
    },
    resume(id: number) {
      const item = requireItem(id)
      item.resume()
      snapshot(id, item)
    },
    cancel(id: number) {
      const item = requireItem(id)
      item.cancel()
      snapshot(id, item)
      items.delete(id)
    },
    handleWillDownload(item: DownloadItemLike) {
      const url = item.getURL()
      const filename = sanitizeFilename(item.getFilename() || filenameFromUrl(url))
      const savePath = assertWithinRoot(
        join(deps.downloadsDir, `${now()}-${filename}`),
        deps.downloadsDir
      )
      item.setSavePath(savePath)

      const pending = (
        deps.db
          .prepare(
            `SELECT * FROM downloads
             WHERE url = ? AND state = 'progressing' AND save_path = ''
             ORDER BY id ASC`
          )
          .all(url) as DownloadRow[]
      ).find((row) => !items.has(row.id))

      const record = pending
        ? decode(pending)
        : insert({
            url,
            filename,
            savePath,
            state: 'progressing',
            received: 0,
            total: 0,
            finishedAt: null
          })

      items.set(record.id, item)
      const bound = snapshot(record.id, item)
      item.on('updated', () => {
        if (!items.has(record.id)) return
        snapshot(record.id, item)
      })
      item.on('done', () => {
        snapshot(record.id, item)
        items.delete(record.id)
      })
      return bound
    }
  }
}
