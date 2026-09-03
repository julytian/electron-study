import { describe, expect, it } from 'vitest'
import { dailyLogFileName } from '../src/main/services/daily-log'

describe('dailyLogFileName', () => {
  it('uses main-YYYY-MM-DD.log in local time', () => {
    expect(dailyLogFileName(new Date(2026, 8, 3))).toBe('main-2026-09-03.log')
  })
})
