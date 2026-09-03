import { describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, existsSync } from 'node:fs'
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
}): SystemClipboard & { text: string; html: string; image: NativeImageLike } {
  const state = {
    text: initial?.text ?? '',
    html: initial?.html ?? '',
    image: initial?.image ?? emptyImage()
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
    readText: () => state.text,
    readHTML: () => state.html,
    readImage: () => state.image,
    writeText: (text: string) => {
      state.text = text
    },
    writeHTML: (html: string) => {
      state.html = html
    }
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
})
