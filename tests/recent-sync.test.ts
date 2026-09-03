import { describe, expect, it } from 'vitest'
import {
  RECENT_FILE_LIMIT,
  dedupeRecentRows,
  filterExistingPaths,
  pathsForAddRecentDocument,
  pathsForSystemRecent
} from '../src/main/services/recent-sync'

describe('dedupeRecentRows', () => {
  it('keeps the newest row per path', () => {
    const rows = [
      { path: '/a.md', openedAt: 2 },
      { path: '/a.md', openedAt: 1 },
      { path: '/b.md', openedAt: 3 }
    ]
    expect(dedupeRecentRows(rows)).toEqual([
      { path: '/b.md', openedAt: 3 },
      { path: '/a.md', openedAt: 2 }
    ])
  })
})

describe('filterExistingPaths', () => {
  it('drops missing files', () => {
    const exists = (p: string) => p === '/keep.md'
    expect(filterExistingPaths(['/keep.md', '/gone.md'], exists)).toEqual(['/keep.md'])
  })
})

describe('pathsForSystemRecent', () => {
  it('dedupes, filters, sorts newest first, and caps at 15', () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({
      path: `/f${i}.md`,
      openedAt: i
    }))
    const exists = () => true
    const paths = pathsForSystemRecent(rows, exists)
    expect(paths).toHaveLength(RECENT_FILE_LIMIT)
    expect(paths[0]).toBe('/f19.md')
    expect(paths[14]).toBe('/f5.md')
  })
})

describe('pathsForAddRecentDocument', () => {
  it('returns the same files as system recent, oldest first', () => {
    const rows = [
      { path: '/new.md', openedAt: 3 },
      { path: '/old.md', openedAt: 1 },
      { path: '/mid.md', openedAt: 2 },
      { path: '/gone.md', openedAt: 4 }
    ]
    const exists = (p: string) => p !== '/gone.md'
    expect(pathsForAddRecentDocument(rows, exists)).toEqual(['/old.md', '/mid.md', '/new.md'])
  })
})
