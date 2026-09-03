import { describe, expect, it } from 'vitest'
import { shouldReloadRenderer } from '../src/shared/process-gone'

describe('shouldReloadRenderer', () => {
  it('reloads the main window twice then stops', () => {
    expect(
      shouldReloadRenderer({ isMainWindow: true, reason: 'crashed', consecutiveReloads: 0 })
    ).toBe(true)
    expect(
      shouldReloadRenderer({ isMainWindow: true, reason: 'crashed', consecutiveReloads: 1 })
    ).toBe(true)
    expect(
      shouldReloadRenderer({ isMainWindow: true, reason: 'crashed', consecutiveReloads: 2 })
    ).toBe(false)
  })

  it('does not reload clean-exit or non-main windows', () => {
    expect(
      shouldReloadRenderer({ isMainWindow: true, reason: 'clean-exit', consecutiveReloads: 0 })
    ).toBe(false)
    expect(
      shouldReloadRenderer({ isMainWindow: false, reason: 'crashed', consecutiveReloads: 0 })
    ).toBe(false)
    expect(
      shouldReloadRenderer({ isMainWindow: false, reason: 'oom', consecutiveReloads: 0 })
    ).toBe(false)
  })

  it('reloads unknown crash reasons on the main window', () => {
    expect(
      shouldReloadRenderer({ isMainWindow: true, reason: 'oom', consecutiveReloads: 0 })
    ).toBe(true)
    expect(
      shouldReloadRenderer({
        isMainWindow: true,
        reason: 'integrity-failure',
        consecutiveReloads: 1
      })
    ).toBe(true)
  })
})
