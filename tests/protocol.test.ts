import { describe, expect, it } from 'vitest'
import {
  extractFileFromArgv,
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

describe('extractFileFromArgv', () => {
  it('finds a Windows .md path among argv', () => {
    expect(
      extractFileFromArgv([
        'C:\\Program Files\\Electron Lab\\ElectronLab.exe',
        'C:\\Users\\me\\note.md'
      ])
    ).toBe('C:\\Users\\me\\note.md')
  })

  it('finds a Linux .md path among argv', () => {
    expect(
      extractFileFromArgv(['/opt/ElectronLab/electron-lab', '/home/me/docs/readme.md'])
    ).toBe('/home/me/docs/readme.md')
  })

  it('ignores the executable, dot, flags, and protocol URLs', () => {
    expect(
      extractFileFromArgv([
        '/usr/local/bin/electron',
        '.',
        '--inspect=9229',
        'electron-lab://note/12'
      ])
    ).toBeNull()
  })

  it('skips the defaultApp entry script and prefers .md', () => {
    expect(
      extractFileFromArgv([
        '/usr/local/bin/electron',
        '/repo/out/main/index.js',
        '--enable-logging',
        '/tmp/opened.md'
      ])
    ).toBe('/tmp/opened.md')
  })

  it('picks a non-md absolute path after skipping the entry script', () => {
    expect(
      extractFileFromArgv([
        'C:\\Program Files\\Electron\\electron.exe',
        'C:\\app\\out\\main\\index.js',
        'C:\\Users\\me\\photo.png'
      ])
    ).toBe('C:\\Users\\me\\photo.png')
  })

  it('returns null when no file path is present', () => {
    expect(extractFileFromArgv(['electron', '.'])).toBeNull()
  })
})
