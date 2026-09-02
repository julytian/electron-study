import { describe, expect, it } from 'vitest'
import { isAllowedExternalUrl } from '../src/shared/external-url'

describe('isAllowedExternalUrl', () => {
  it('allows https and mailto', () => {
    expect(isAllowedExternalUrl('https://electron-vite.org')).toBe(true)
    expect(isAllowedExternalUrl('mailto:dev@example.com')).toBe(true)
  })

  it('rejects file and javascript', () => {
    expect(isAllowedExternalUrl('file:///etc/passwd')).toBe(false)
    expect(isAllowedExternalUrl('javascript:alert(1)')).toBe(false)
    expect(isAllowedExternalUrl('http://insecure.local')).toBe(false)
  })
})
