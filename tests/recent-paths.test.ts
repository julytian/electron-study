import { describe, expect, it } from 'vitest'
import { existingRecentPaths } from '../src/main/platforms/recent-paths'

describe('existingRecentPaths', () => {
  it('drops missing files and keeps unique newest-first paths', () => {
    const exists = (p: string): boolean => p !== '/gone.md'
    const rows = [{ path: '/a.md' }, { path: '/gone.md' }, { path: '/a.md' }, { path: '/b.md' }]

    expect(existingRecentPaths(rows, exists)).toEqual(['/a.md', '/b.md'])
  })

  it('caps results at the given limit', () => {
    const exists = (): boolean => true
    const rows = [{ path: '/1' }, { path: '/2' }, { path: '/3' }, { path: '/4' }]

    expect(existingRecentPaths(rows, exists, 2)).toEqual(['/1', '/2'])
  })
})
