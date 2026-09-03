import { describe, expect, it } from 'vitest'
import {
  isRendererNavigationAllowed,
  isSameRendererDocument,
  shouldHideToTray,
  withHash
} from '../src/main/windows/window-policy'

describe('withHash', () => {
  it('keeps origin and sets the hash route', () => {
    expect(withHash('http://localhost:5173/', '/workbench/clipboard')).toBe(
      'http://localhost:5173/#/workbench/clipboard'
    )
  })

  it('replaces an existing hash without changing the origin', () => {
    expect(withHash('http://localhost:5173/#/workbench/notes', '#/workbench/clipboard')).toBe(
      'http://localhost:5173/#/workbench/clipboard'
    )
  })

  it('preserves file:// renderer paths', () => {
    expect(withHash('file:///tmp/renderer/index.html', '/workbench/notes')).toBe(
      'file:///tmp/renderer/index.html#/workbench/notes'
    )
  })
})

describe('isSameRendererDocument', () => {
  it('allows hash-only navigation on the same renderer URL', () => {
    expect(
      isSameRendererDocument(
        'http://localhost:5173/',
        'http://localhost:5173/#/workbench/clipboard'
      )
    ).toBe(true)
  })

  it('rejects a different host', () => {
    expect(
      isSameRendererDocument('http://localhost:5173/', 'https://example.com/#/workbench/notes')
    ).toBe(false)
  })
})

describe('isRendererNavigationAllowed', () => {
  it('allows hash-only navigation on the same renderer document', () => {
    expect(
      isRendererNavigationAllowed(
        'http://localhost:5173/',
        'http://localhost:5173/#/windows/lab',
        true
      )
    ).toBe(true)
  })

  it('allows localhost only in development', () => {
    expect(
      isRendererNavigationAllowed('http://localhost:5173/', 'http://127.0.0.1:5173/', true)
    ).toBe(true)
    expect(
      isRendererNavigationAllowed('http://localhost:5173/', 'http://127.0.0.1:5173/', false)
    ).toBe(false)
  })

  it('rejects an external site even in development', () => {
    expect(
      isRendererNavigationAllowed('http://localhost:5173/', 'https://example.com/', true)
    ).toBe(false)
  })
})

describe('shouldHideToTray', () => {
  it('hides on Windows when close-to-tray is on and the app is not quitting', () => {
    expect(
      shouldHideToTray({ closeToTray: true, platform: 'win32', quitting: false })
    ).toBe(true)
  })

  it('hides on macOS even when close-to-tray is off', () => {
    expect(
      shouldHideToTray({ closeToTray: false, platform: 'darwin', quitting: false })
    ).toBe(true)
  })

  it('does not hide on macOS while quitting', () => {
    expect(
      shouldHideToTray({ closeToTray: false, platform: 'darwin', quitting: true })
    ).toBe(false)
  })

  it('does not hide while the app is quitting', () => {
    expect(
      shouldHideToTray({ closeToTray: true, platform: 'linux', quitting: true })
    ).toBe(false)
  })

  it('does not hide when close-to-tray is off', () => {
    expect(
      shouldHideToTray({ closeToTray: false, platform: 'win32', quitting: false })
    ).toBe(false)
  })
})
