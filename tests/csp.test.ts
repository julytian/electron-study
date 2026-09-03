import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cspHeader, shouldAttachCsp } from '../src/shared/csp'

describe('cspHeader', () => {
  it('matches the renderer index.html meta content', () => {
    const html = readFileSync(resolve(__dirname, '../src/renderer/index.html'), 'utf8')
    const match = html.match(/http-equiv="Content-Security-Policy"[\s\S]*?content="([^"]+)"/)
    expect(match?.[1]).toBeTruthy()
    expect(cspHeader()).toBe(match?.[1])
  })
})

describe('shouldAttachCsp', () => {
  it('attaches only for packaged app sessions', () => {
    expect(shouldAttachCsp('app', true)).toBe(true)
    expect(shouldAttachCsp('app', false)).toBe(false)
    expect(shouldAttachCsp('browser', true)).toBe(false)
    expect(shouldAttachCsp('browser', false)).toBe(false)
  })
})
