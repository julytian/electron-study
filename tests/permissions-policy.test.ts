import { describe, expect, it } from 'vitest'
import {
  permissionsPolicyHeader,
  shouldAttachPermissionsPolicy
} from '../src/shared/permissions-policy'

describe('permissionsPolicyHeader', () => {
  it('disables geo camera usb serial hid bluetooth and display-capture', () => {
    const header = permissionsPolicyHeader()
    expect(header).toContain('geolocation=()')
    expect(header).toContain('camera=()')
    expect(header).toContain('usb=()')
    expect(header).toContain('serial=()')
    expect(header).toContain('hid=()')
    expect(header).toContain('bluetooth=()')
    expect(header).toContain('display-capture=()')
  })
})

describe('shouldAttachPermissionsPolicy', () => {
  it('matches CSP attach conditions', () => {
    expect(shouldAttachPermissionsPolicy('app', true)).toBe(true)
    expect(shouldAttachPermissionsPolicy('app', false)).toBe(false)
    expect(shouldAttachPermissionsPolicy('browser', true)).toBe(false)
    expect(shouldAttachPermissionsPolicy('browser', false)).toBe(false)
  })
})
