import { describe, expect, it } from 'vitest'
import { SECURITY_CHECKLIST } from '../src/shared/security-checklist'
import { formatSecurityStatus } from '../src/shared/security-status'

describe('SECURITY_CHECKLIST', () => {
  it('has eight rows with id title file and detail', () => {
    expect(SECURITY_CHECKLIST).toHaveLength(8)
    expect(SECURITY_CHECKLIST.map((row) => row.id)).toEqual([
      'sandbox',
      'context-isolation',
      'no-node',
      'permission-check',
      'navigation',
      'no-webview',
      'csp',
      'fuses'
    ])
    for (const row of SECURITY_CHECKLIST) {
      expect(row.title.length).toBeGreaterThan(0)
      expect(row.file.length).toBeGreaterThan(0)
      expect(row.detail.length).toBeGreaterThan(0)
    }
  })
})

describe('formatSecurityStatus', () => {
  it('joins packaged csp permissionCheck and fuse declarations', () => {
    const dev = formatSecurityStatus(false)
    expect(dev).toContain('packaged=false')
    expect(dev).toContain('cspSession=false')
    expect(dev).toContain('permissionCheck=true')
    expect(dev).toContain('fuses.runAsNode=false')
    expect(dev).toContain('fuses.enableCookieEncryption=true')

    const packaged = formatSecurityStatus(true)
    expect(packaged).toContain('packaged=true')
    expect(packaged).toContain('cspSession=true')
  })
})
