import { describe, expect, it } from 'vitest'
import {
  isDefaultSessionPermissionAllowed,
  isSessionPermissionAllowed
} from '../src/main/services/session-permissions'

describe('isDefaultSessionPermissionAllowed', () => {
  it('allows the workbench permissions the spec whitelist', () => {
    expect(isDefaultSessionPermissionAllowed('notifications')).toBe(true)
    expect(isDefaultSessionPermissionAllowed('clipboard-read')).toBe(true)
    expect(isDefaultSessionPermissionAllowed('clipboard-sanitized-write')).toBe(true)
    expect(isDefaultSessionPermissionAllowed('media')).toBe(true)
    expect(isDefaultSessionPermissionAllowed('display-capture')).toBe(true)
    expect(isDefaultSessionPermissionAllowed('fullscreen')).toBe(true)
  })

  it('denies everything else by default', () => {
    expect(isDefaultSessionPermissionAllowed('geolocation')).toBe(false)
    expect(isDefaultSessionPermissionAllowed('openExternal')).toBe(false)
    expect(isDefaultSessionPermissionAllowed('pointerLock')).toBe(false)
  })
})

describe('isSessionPermissionAllowed', () => {
  it('uses the app whitelist and denies all browser permissions', () => {
    expect(isSessionPermissionAllowed('app', 'notifications')).toBe(true)
    expect(isSessionPermissionAllowed('browser', 'notifications')).toBe(false)
    expect(isSessionPermissionAllowed('browser', 'media')).toBe(false)
    expect(isSessionPermissionAllowed('browser', 'geolocation')).toBe(false)
  })
})
