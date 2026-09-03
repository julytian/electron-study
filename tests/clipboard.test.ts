import { describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, existsSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { migrate } from '../src/main/services/db/migrations'
import {
  createClipboardService,
  type NativeImageLike,
  type SystemClipboard
} from '../src/main/services/clipboard'

function memoryDb(): Database.Database {
  const db = new Database(':memory:')
  migrate(db)
  return db
}

function emptyImage(): NativeImageLike {
  return {
    isEmpty: () => true,
    toPNG: () => Buffer.alloc(0)
  }
}

function pngImage(bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47])): NativeImageLike {
  return {
    isEmpty: () => false,
    toPNG: () => bytes
  }
}

function stubClipboard(initial?: {
  text?: string
  html?: string
  image?: NativeImageLike
}): SystemClipboard & {
  text: string
  html: string
  image: NativeImageLike
  writtenImage: Buffer | null
} {
  const state = {
    text: initial?.text ?? '',
    html: initial?.html ?? '',
    image: initial?.image ?? emptyImage(),
    writtenImage: null as Buffer | null
  }
  return {
    get text() {
      return state.text
    },
    get html() {
      return state.html
    },
    get image() {
      return state.image
    },
    get writtenImage() {
      return state.writtenImage
    },
    readText: () => state.text,
    readHTML: () => state.html,
    readImage: () => state.image,
    writeText: (text: string) => {
      state.text = text
    },
    writeHTML: (html: string) => {
      state.html = html
    },
    writeImage: (png: Buffer) => {
      state.writtenImage = png
      state.image = pngImage(png)
    }
  }
}

function expectNamedError(fn: () => void, name: string): void {
  expect(fn).toThrowError(new RegExp(name))
  try {
    fn()
  } catch (error) {
    expect(error).toMatchObject({ name })
    expect((error as Error).message).toContain(name)
  }
}

describe('clipboard service', () => {
  it('reads text and html from the system clipboard and persists history', () => {
    const dir = mkdtempSync(join(tmpdir(), 'elab-clip-'))
    const clipboard = stubClipboard({ text: 'hello', html: '<b>hello</b>' })
    const service = createClipboardService(memoryDb(), clipboard, dir)

    const snapshot = service.read()

    expect(snapshot).toEqual({ text: 'hello', html: '<b>hello</b>', hasImage: false })
    const items = service.history()
    expect(items).toHaveLength(1)
    expect(items[0]?.kind).toBe('html')
    expect(items[0]?.text).toBe('hello')
    expect(items[0]?.html).toBe('<b>hello</b>')
    expect(items[0]?.imagePath).toBeNull()
  })

  it('saves clipboard images under clipboardDir after path-jail check', () => {
    const dir = mkdtempSync(join(tmpdir(), 'elab-clip-'))
    const png = Buffer.from('fake-png')
    const clipboard = stubClipboard({ image: pngImage(png) })
    const service = createClipboardService(memoryDb(), clipboard, dir)

    const snapshot = service.read()

    expect(snapshot.hasImage).toBe(true)
    const item = service.history()[0]
    expect(item?.kind).toBe('image')
    expect(item?.imagePath).toBeTruthy()
    expect(item?.imagePath?.startsWith(dir)).toBe(true)
    expect(existsSync(item?.imagePath ?? '')).toBe(true)
    expect(readFileSync(item?.imagePath ?? '')).toEqual(png)
  })

  it('writes text back to the system clipboard and returns the stored item', () => {
    const dir = mkdtempSync(join(tmpdir(), 'elab-clip-'))
    const clipboard = stubClipboard()
    const service = createClipboardService(memoryDb(), clipboard, dir)

    const item = service.write({ kind: 'text', text: 'copied' })

    expect(clipboard.text).toBe('copied')
    expect(item.kind).toBe('text')
    expect(item.text).toBe('copied')
    expect(service.history()[0]?.id).toBe(item.id)
  })

  it('writes html back to the system clipboard', () => {
    const dir = mkdtempSync(join(tmpdir(), 'elab-clip-'))
    const clipboard = stubClipboard()
    const service = createClipboardService(memoryDb(), clipboard, dir)

    const item = service.write({ kind: 'html', html: '<i>x</i>', text: 'x' })

    expect(clipboard.html).toBe('<i>x</i>')
    expect(clipboard.text).toBe('x')
    expect(item.kind).toBe('html')
    expect(item.html).toBe('<i>x</i>')
  })

  it('lists history newest first and clears it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'elab-clip-'))
    const service = createClipboardService(memoryDb(), stubClipboard(), dir)
    service.write({ kind: 'text', text: 'first' })
    service.write({ kind: 'text', text: 'second' })

    expect(service.history().map((item) => item.text)).toEqual(['second', 'first'])

    service.clearHistory()
    expect(service.history()).toEqual([])
  })

  it('restores text to the system clipboard without inserting a new history row', () => {
    const dir = mkdtempSync(join(tmpdir(), 'elab-clip-'))
    const clipboard = stubClipboard()
    const service = createClipboardService(memoryDb(), clipboard, dir)
    const item = service.write({ kind: 'text', text: 'restore-me' })
    clipboard.writeText('changed')

    service.restore(item.id)

    expect(clipboard.text).toBe('restore-me')
    expect(service.history()).toHaveLength(1)
  })

  it('restores html and text without inserting a new history row', () => {
    const dir = mkdtempSync(join(tmpdir(), 'elab-clip-'))
    const clipboard = stubClipboard()
    const service = createClipboardService(memoryDb(), clipboard, dir)
    const item = service.write({ kind: 'html', html: '<i>x</i>', text: 'x' })
    clipboard.writeHTML('')
    clipboard.writeText('')

    service.restore(item.id)

    expect(clipboard.html).toBe('<i>x</i>')
    expect(clipboard.text).toBe('x')
    expect(service.history()).toHaveLength(1)
  })

  it('restores an image by writing the same png bytes without inserting a new history row', () => {
    const dir = mkdtempSync(join(tmpdir(), 'elab-clip-'))
    const png = Buffer.from('fake-png-restore')
    const clipboard = stubClipboard({ image: pngImage(png) })
    const service = createClipboardService(memoryDb(), clipboard, dir)
    service.read()
    const item = service.history()[0]
    clipboard.writeImage(Buffer.from('other'))

    service.restore(item!.id)

    expect(clipboard.writtenImage).toEqual(png)
    expect(clipboard.image.toPNG()).toEqual(png)
    expect(service.history()).toHaveLength(1)
  })

  it('restore of a missing id throws E_NOT_FOUND', () => {
    const dir = mkdtempSync(join(tmpdir(), 'elab-clip-'))
    const service = createClipboardService(memoryDb(), stubClipboard(), dir)

    expectNamedError(() => service.restore(999), 'E_NOT_FOUND')
  })

  it('restore of an image_path outside clipboardDir throws E_PATH', () => {
    const dir = mkdtempSync(join(tmpdir(), 'elab-clip-'))
    const db = memoryDb()
    const service = createClipboardService(db, stubClipboard(), dir)
    const outside = '/tmp/elab-outside-xxx.png'
    db.prepare(
      'INSERT INTO clipboard_items (kind, text, html, image_path, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run('image', null, null, outside, Date.now())
    const row = db.prepare('SELECT id FROM clipboard_items WHERE image_path = ?').get(outside) as {
      id: number
    }

    expectNamedError(() => service.restore(row.id), 'E_PATH')
  })

  it('deletes a text row and leaves history empty', () => {
    const dir = mkdtempSync(join(tmpdir(), 'elab-clip-'))
    const service = createClipboardService(memoryDb(), stubClipboard(), dir)
    const item = service.write({ kind: 'text', text: 'drop-me' })

    service.delete(item.id)

    expect(service.history()).toEqual([])
  })

  it('deletes an image row and its file, then throws E_NOT_FOUND for the same id', () => {
    const dir = mkdtempSync(join(tmpdir(), 'elab-clip-'))
    const png = Buffer.from('fake-png-delete')
    const service = createClipboardService(
      memoryDb(),
      stubClipboard({ image: pngImage(png) }),
      dir
    )
    service.read()
    const item = service.history()[0]
    const imagePath = item!.imagePath ?? ''

    service.delete(item!.id)

    expect(existsSync(imagePath)).toBe(false)
    expect(service.history()).toEqual([])
    expectNamedError(() => service.delete(item!.id), 'E_NOT_FOUND')
  })

  it('deletes an image row after the file is already gone without throwing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'elab-clip-'))
    const png = Buffer.from('fake-png-gone')
    const service = createClipboardService(
      memoryDb(),
      stubClipboard({ image: pngImage(png) }),
      dir
    )
    service.read()
    const item = service.history()[0]
    unlinkSync(item!.imagePath ?? '')

    expect(() => service.delete(item!.id)).not.toThrow()
    expect(service.history()).toEqual([])
  })
})
