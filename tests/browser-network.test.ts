import { describe, expect, it } from 'vitest'
import {
  BROWSER_PARTITION,
  REQUEST_FILTER_URLS,
  certificateVerifyVerdict,
  resolveAllowInsecureCerts,
  shouldCancelFilteredRequest
} from '../src/main/services/browser-network'

describe('BROWSER_PARTITION', () => {
  it('targets persist:browser and never the default session', () => {
    expect(BROWSER_PARTITION).toBe('persist:browser')
    expect(BROWSER_PARTITION).not.toBe('persist:default')
    expect(BROWSER_PARTITION.startsWith('persist:')).toBe(true)
  })
})

describe('shouldCancelFilteredRequest', () => {
  it('cancels https URLs that include blocked.example', () => {
    expect(shouldCancelFilteredRequest('https://blocked.example/ads.js')).toBe(true)
    expect(shouldCancelFilteredRequest('https://cdn.blocked.example/track')).toBe(true)
  })

  it('lets other https URLs through', () => {
    expect(shouldCancelFilteredRequest('https://example.com/')).toBe(false)
    expect(shouldCancelFilteredRequest('https://github.com/electron')).toBe(false)
  })
})

describe('REQUEST_FILTER_URLS', () => {
  it('only matches https so http traffic is not intercepted', () => {
    expect(REQUEST_FILTER_URLS).toEqual(['https://*/*'])
  })
})

describe('certificateVerifyVerdict', () => {
  it('uses Chromium default verification when insecure certs are off', () => {
    expect(certificateVerifyVerdict(false)).toBe(-3)
  })

  it('accepts the certificate only when the lab switch is on', () => {
    expect(certificateVerifyVerdict(true)).toBe(0)
  })
})

describe('resolveAllowInsecureCerts', () => {
  it('allows enabling in unpackaged / dev builds', () => {
    expect(resolveAllowInsecureCerts(true, false)).toEqual({ ok: true, allow: true })
  })

  it('always allows turning the switch off', () => {
    expect(resolveAllowInsecureCerts(false, true)).toEqual({ ok: true, allow: false })
    expect(resolveAllowInsecureCerts(false, false)).toEqual({ ok: true, allow: false })
  })

  it('rejects enabling in a packaged production app', () => {
    expect(resolveAllowInsecureCerts(true, true)).toEqual({
      ok: false,
      code: 'E_PLATFORM'
    })
  })
})
