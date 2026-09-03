import { describe, expect, it } from 'vitest'
import { powerChangedPayload, powerSnapshot, readOnlineFlag } from '../src/shared/power-status'

describe('powerSnapshot', () => {
  it('maps injected online flags', () => {
    expect(
      powerSnapshot({ onBattery: true, idleState: 'active', isOnline: true })
    ).toEqual({ onBattery: true, idleState: 'active', online: true })
    expect(
      powerSnapshot({ onBattery: false, idleState: 'idle', isOnline: false })
    ).toEqual({ onBattery: false, idleState: 'idle', online: false })
  })
})

describe('powerChangedPayload', () => {
  it('omits idle state', () => {
    expect(powerChangedPayload({ onBattery: true, isOnline: false })).toEqual({
      onBattery: true,
      online: false
    })
  })
})

describe('readOnlineFlag', () => {
  it('returns false when the probe throws', () => {
    expect(readOnlineFlag(() => true)).toBe(true)
    expect(
      readOnlineFlag(() => {
        throw new Error('offline probe failed')
      })
    ).toBe(false)
  })
})
