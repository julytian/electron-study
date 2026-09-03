import { describe, expect, it } from 'vitest'
import { SECURITY_CHECKLIST } from '../src/shared/security-checklist'
import { formatSecurityStatus } from '../src/shared/security-status'

describe('SECURITY_CHECKLIST', () => {
  it('has eleven rows with id title file and detail', () => {
    expect(SECURITY_CHECKLIST).toHaveLength(11)
    expect(SECURITY_CHECKLIST.map((row) => row.id)).toEqual([
      'sandbox',
      'context-isolation',
      'no-node',
      'permission-check',
      'navigation',
      'no-webview',
      'csp',
      'fuses',
      'process-recovery',
      'display-media',
      'device-permission'
    ])
    for (const row of SECURITY_CHECKLIST) {
      expect(row.title.length).toBeGreaterThan(0)
      expect(row.file.length).toBeGreaterThan(0)
      expect(row.detail.length).toBeGreaterThan(0)
    }
  })
})

describe('formatSecurityStatus', () => {
  it('joins packaged csp permissionCheck fuses and deny flags', () => {
    const dev = formatSecurityStatus(false)
    expect(dev).toContain('packaged=false')
    expect(dev).toContain('cspSession=false')
    expect(dev).toContain('permissionCheck=true')
    expect(dev).toContain('fuses.runAsNode=false')
    expect(dev).toContain('fuses.enableCookieEncryption=true')
    expect(dev).toContain('enableSandbox=true')
    expect(dev).toContain('displayMedia=deny')
    expect(dev).toContain('devicePermission=deny')

    const packaged = formatSecurityStatus(true)
    expect(packaged).toContain('packaged=true')
    expect(packaged).toContain('cspSession=true')
    expect(packaged).toContain('enableSandbox=true')
  })
})
