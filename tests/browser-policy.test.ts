import { describe, expect, it } from 'vitest'
import {
  BROWSER_SIDER_WIDTH,
  BROWSER_TOOLBAR_HEIGHT,
  browserViewBounds,
  isBrowserRoute,
  normalizeBrowserUrl
} from '../src/main/windows/browser-policy'

describe('normalizeBrowserUrl', () => {
  it('keeps an https URL', () => {
    expect(normalizeBrowserUrl('https://example.com/path')).toEqual({
      ok: true,
      url: 'https://example.com/path'
    })
  })

  it('prepends https:// when the user typed a bare host', () => {
    expect(normalizeBrowserUrl('example.com')).toEqual({
      ok: true,
      url: 'https://example.com/'
    })
  })

  it('rejects http, file and javascript', () => {
    expect(normalizeBrowserUrl('http://insecure.local').ok).toBe(false)
    expect(normalizeBrowserUrl('file:///etc/passwd').ok).toBe(false)
    expect(normalizeBrowserUrl('javascript:alert(1)').ok).toBe(false)
  })

  it('rejects empty input', () => {
    expect(normalizeBrowserUrl('   ').ok).toBe(false)
  })
})

describe('isBrowserRoute', () => {
  it('detects the /browser hash on a renderer URL', () => {
    expect(isBrowserRoute('http://localhost:5173/#/browser')).toBe(true)
    expect(isBrowserRoute('file:///tmp/renderer/index.html#/browser')).toBe(true)
    expect(isBrowserRoute('#/browser')).toBe(true)
  })

  it('is false when the hash is another lab route', () => {
    expect(isBrowserRoute('http://localhost:5173/#/workbench/notes')).toBe(false)
    expect(isBrowserRoute('http://localhost:5173/#/lab/network')).toBe(false)
    expect(isBrowserRoute('http://localhost:5173/')).toBe(false)
  })
})

describe('browserViewBounds', () => {
  it('leaves room for the sider and address bar', () => {
    expect(BROWSER_SIDER_WIDTH).toBe(240)
    expect(BROWSER_TOOLBAR_HEIGHT).toBeGreaterThanOrEqual(56)
    expect(BROWSER_TOOLBAR_HEIGHT).toBeLessThanOrEqual(80)
    expect(browserViewBounds({ width: 1200, height: 800 })).toEqual({
      x: 240,
      y: BROWSER_TOOLBAR_HEIGHT,
      width: 1200 - 240,
      height: 800 - BROWSER_TOOLBAR_HEIGHT
    })
  })

  it('does not produce negative size on a tiny window', () => {
    expect(browserViewBounds({ width: 100, height: 40 })).toEqual({
      x: 240,
      y: BROWSER_TOOLBAR_HEIGHT,
      width: 0,
      height: 0
    })
  })
})
