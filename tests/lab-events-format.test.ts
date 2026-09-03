import { describe, expect, it } from 'vitest'
import { formatRecentProcessEvents, type LabEventRowLike } from '../src/shared/lab-event-format'

function row(
  partial: Partial<LabEventRowLike> & Pick<LabEventRowLike, 'module' | 'action'>
): LabEventRowLike {
  return {
    ok: false,
    message: 'gone',
    createdAt: 1,
    ...partial
  }
}

describe('formatRecentProcessEvents', () => {
  it('returns the empty copy when there are no process rows', () => {
    expect(formatRecentProcessEvents([])).toBe('暂无进程事件')
    expect(
      formatRecentProcessEvents([row({ module: 'metrics', action: 'refresh', createdAt: 9 })])
    ).toBe('暂无进程事件')
  })

  it('keeps only process rows, newest first, and caps at 10', () => {
    const rows: LabEventRowLike[] = [
      row({ module: 'process', action: 'old', createdAt: 1, message: 'a' }),
      row({ module: 'metrics', action: 'refresh', createdAt: 99, message: 'skip' }),
      row({ module: 'process', action: 'new', createdAt: 5, ok: true, message: 'b' })
    ]
    expect(formatRecentProcessEvents(rows)).toBe('new ok=true b; old ok=false a')

    const many = Array.from({ length: 12 }, (_, index) =>
      row({
        module: 'process',
        action: `e${index}`,
        createdAt: index,
        message: `m${index}`
      })
    )
    const text = formatRecentProcessEvents(many, 10)
    expect(text.startsWith('e11 ok=false m11')).toBe(true)
    expect(text.includes('e0 ')).toBe(false)
    expect(text.split('; ')).toHaveLength(10)
  })
})
