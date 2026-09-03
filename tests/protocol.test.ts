import { describe, expect, it } from 'vitest'
import {
  extractUrlFromArgv,
  isMarkdownPath,
  noteTitleFromMarkdownPath
} from '../src/main/services/protocol-url'

describe('extractUrlFromArgv', () => {
  it('finds electron-lab://note/12 among argv', () => {
    expect(
      extractUrlFromArgv([
        '/Applications/Electron.app/Contents/MacOS/Electron',
        'electron-lab://note/12'
      ])
    ).toBe('electron-lab://note/12')
  })

  it('ignores flags and electron paths', () => {
    expect(
      extractUrlFromArgv([
        '/usr/local/bin/electron',
        '.',
        '--inspect=9229',
        '--enable-logging'
      ])
    ).toBeNull()
  })

  it('returns null when the protocol URL is absent', () => {
    expect(extractUrlFromArgv(['electron', '.'])).toBeNull()
  })
})

describe('isMarkdownPath', () => {
  it('accepts .md case-insensitively', () => {
    expect(isMarkdownPath('/Users/me/Note.MD')).toBe(true)
    expect(isMarkdownPath('C:\\docs\\readme.md')).toBe(true)
  })

  it('rejects non-markdown paths', () => {
    expect(isMarkdownPath('/Users/me/photo.png')).toBe(false)
    expect(isMarkdownPath('/Users/me/notes.md.bak')).toBe(false)
  })
})

describe('noteTitleFromMarkdownPath', () => {
  it('uses basename without the .md suffix', () => {
    expect(noteTitleFromMarkdownPath('/tmp/Meeting Notes.md')).toBe('Meeting Notes')
  })
})
