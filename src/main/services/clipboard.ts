import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import type Database from 'better-sqlite3'
import type { ClipboardItem, ClipboardKind } from '../../shared/models'
import { assertWithinRoot } from './path-jail'

export interface NativeImageLike {
  isEmpty(): boolean
  toPNG(): Buffer
}

export interface SystemClipboard {
  readText(): string
  readHTML(): string
  readImage(): NativeImageLike
  writeText(text: string): void
  writeHTML(html: string): void
  writeImage(png: Buffer): void
}

interface ClipboardRow {
  id: number
  kind: ClipboardKind
  text: string | null
  html: string | null
  image_path: string | null
  created_at: number
}

function validationError(message: string): Error {
  return Object.assign(new Error(message), { name: 'E_VALIDATION' })
}

function notFoundError(message = 'E_NOT_FOUND: Clipboard item is missing'): Error {
  return Object.assign(new Error(message), { name: 'E_NOT_FOUND' })
}

function assertPositiveId(id: number): void {
  if (!Number.isInteger(id) || id <= 0) {
    throw validationError('E_VALIDATION: id must be a positive integer')
  }
}

function decode(row: ClipboardRow): ClipboardItem {
  return {
    id: row.id,
    kind: row.kind,
    text: row.text,
    html: row.html,
    imagePath: row.image_path,
    createdAt: row.created_at
  }
}

export interface ClipboardService {
  read(): { text: string; html: string; hasImage: boolean }
  write(input: { kind: ClipboardKind; text?: string; html?: string }): ClipboardItem
  history(): ClipboardItem[]
  clearHistory(): void
  restore(id: number): void
  delete(id: number): void
}

export function createClipboardService(
  db: Database.Database,
  system: SystemClipboard,
  clipboardDir: string
): ClipboardService {
  function persist(input: {
    kind: ClipboardKind
    text: string | null
    html: string | null
    imagePath: string | null
  }): ClipboardItem {
    const createdAt = Date.now()
    const result = db
      .prepare(
        'INSERT INTO clipboard_items (kind, text, html, image_path, created_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(input.kind, input.text, input.html, input.imagePath, createdAt)
    const row = db
      .prepare('SELECT * FROM clipboard_items WHERE id = ?')
      .get(Number(result.lastInsertRowid)) as ClipboardRow
    return decode(row)
  }

  function saveImage(png: Buffer): string {
    const filePath = assertWithinRoot(
      join(clipboardDir, `clip-${Date.now()}-${randomBytes(4).toString('hex')}.png`),
      clipboardDir
    )
    writeFileSync(filePath, png)
    return filePath
  }

  function snapshotImage(): { hasImage: boolean; imagePath: string | null } {
    const image = system.readImage()
    if (image.isEmpty()) return { hasImage: false, imagePath: null }
    return { hasImage: true, imagePath: saveImage(image.toPNG()) }
  }

  function getRow(id: number): ClipboardRow {
    assertPositiveId(id)
    const row = db.prepare('SELECT * FROM clipboard_items WHERE id = ?').get(id) as
      | ClipboardRow
      | undefined
    if (!row) throw notFoundError()
    return row
  }

  return {
    read() {
      const text = system.readText() || ''
      const html = system.readHTML() || ''
      const { hasImage, imagePath } = snapshotImage()
      if (text || html || hasImage) {
        persist({
          kind: hasImage ? 'image' : html ? 'html' : 'text',
          text: text || null,
          html: html || null,
          imagePath
        })
      }
      return { text, html, hasImage }
    },
    write(input) {
      if (input.kind === 'image') {
        const { hasImage, imagePath } = snapshotImage()
        if (!hasImage || !imagePath) throw validationError('剪贴板没有图片')
        return persist({
          kind: 'image',
          text: input.text ?? null,
          html: input.html ?? null,
          imagePath
        })
      }
      if (input.kind === 'html') {
        if (!input.html) throw validationError('HTML 不能为空')
        system.writeHTML(input.html)
        if (input.text) system.writeText(input.text)
        return persist({
          kind: 'html',
          text: input.text ?? null,
          html: input.html,
          imagePath: null
        })
      }
      if (!input.text) throw validationError('文本不能为空')
      system.writeText(input.text)
      return persist({
        kind: 'text',
        text: input.text,
        html: input.html ?? null,
        imagePath: null
      })
    },
    history() {
      const rows = db
        .prepare('SELECT * FROM clipboard_items ORDER BY created_at DESC, id DESC')
        .all() as ClipboardRow[]
      return rows.map(decode)
    },
    clearHistory() {
      db.prepare('DELETE FROM clipboard_items').run()
    },
    restore(id) {
      const row = getRow(id)
      if (row.kind === 'text') {
        system.writeText(row.text || '')
        return
      }
      if (row.kind === 'html') {
        system.writeHTML(row.html || '')
        if (row.text) system.writeText(row.text)
        return
      }
      if (!row.image_path) throw notFoundError()
      const safe = assertWithinRoot(row.image_path, clipboardDir)
      if (!existsSync(safe)) throw notFoundError()
      system.writeImage(readFileSync(safe))
    },
    delete(id) {
      const row = getRow(id)
      if (row.image_path) {
        try {
          const safe = assertWithinRoot(row.image_path, clipboardDir)
          try {
            unlinkSync(safe)
          } catch {
            // file already gone
          }
        } catch (error) {
          if (!(error instanceof Error) || error.name !== 'E_PATH') throw error
        }
      }
      db.prepare('DELETE FROM clipboard_items WHERE id = ?').run(id)
    }
  }
}
