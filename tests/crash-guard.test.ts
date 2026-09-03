import { describe, expect, it } from 'vitest'
import { canRunCrashDemo } from '../src/main/utility/crash-guard'

describe('canRunCrashDemo', () => {
  it('is false when the app is packaged', () => {
    expect(canRunCrashDemo(true)).toBe(false)
  })

  it('is true when the app is unpackaged', () => {
    expect(canRunCrashDemo(false)).toBe(true)
  })
})
