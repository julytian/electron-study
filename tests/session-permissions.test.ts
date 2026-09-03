import { describe, expect, it } from 'vitest'
import { isDefaultSessionPermissionAllowed } from '../src/main/services/session-permissions'

describe('isDefaultSessionPermissionAllowed', () => {
  it('allows the workbench permissions the spec whitelist', () => {
    expect(isDefaultSessionPermissionAllowed('notifications')).toBe(true)
    expect(isDefaultSessionPermissionAllowed('clipboard-sanitized-write')).toBe(true)
    expect(isDefaultSessionPermissionAllowed('media')).toBe(true)
    expect(isDefaultSessionPermissionAllowed('display-capture')).toBe(true)
  })

  it('denies everything else by default', () => {
    expect(isDefaultSessionPermissionAllowed('geolocation')).toBe(false)
    expect(isDefaultSessionPermissionAllowed('openExternal')).toBe(false)
    expect(isDefaultSessionPermissionAllowed('pointerLock')).toBe(false)
  })
})
