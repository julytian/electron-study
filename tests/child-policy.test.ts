import { describe, expect, it } from 'vitest'
import {
  buildRendererLoad,
  isValidProgress,
  TITLE_BAR_OVERLAY
} from '../src/main/windows/child-policy'

describe('isValidProgress', () => {
  it('accepts values in 0..1 inclusive', () => {
    expect(isValidProgress(0)).toBe(true)
    expect(isValidProgress(0.5)).toBe(true)
    expect(isValidProgress(1)).toBe(true)
  })

  it('rejects values outside 0..1 or non-finite numbers', () => {
    expect(isValidProgress(-0.01)).toBe(false)
    expect(isValidProgress(1.01)).toBe(false)
    expect(isValidProgress(Number.NaN)).toBe(false)
    expect(isValidProgress(Number.POSITIVE_INFINITY)).toBe(false)
  })
})

describe('buildRendererLoad', () => {
  it('uses ELECTRON_RENDERER_URL#hash in dev', () => {
    expect(
      buildRendererLoad('/ports/left', {
        isDev: true,
        rendererUrl: 'http://localhost:5173'
      })
    ).toEqual({ kind: 'url', url: 'http://localhost:5173#/ports/left' })
  })

  it('falls back to loadFile hash when not in renderer-url dev', () => {
    expect(buildRendererLoad('/windows/lab', { isDev: false })).toEqual({
      kind: 'file',
      hash: '/windows/lab'
    })
    expect(buildRendererLoad('/ports/right', { isDev: true })).toEqual({
      kind: 'file',
      hash: '/ports/right'
    })
  })
})

describe('TITLE_BAR_OVERLAY', () => {
  it('matches the lab overlay demo colors and height', () => {
    expect(TITLE_BAR_OVERLAY).toEqual({
      color: '#1677ff',
      symbolColor: '#fff',
      height: 36
    })
  })
})
