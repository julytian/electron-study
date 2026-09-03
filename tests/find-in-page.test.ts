import { describe, expect, it } from 'vitest'
import {
  FIND_IN_PAGE_TIMEOUT_MS,
  emptyFindMatch,
  findResultFromEvent,
  parseFindInPageRequest
} from '../src/shared/find-in-page'

describe('parseFindInPageRequest', () => {
  it('rejects invalid action or query type', () => {
    expect(parseFindInPageRequest('hi', 'jump')).toEqual({
      ok: false,
      message: '查找动作无效'
    })
    expect(parseFindInPageRequest(1, 'next')).toEqual({
      ok: false,
      message: '查找关键字无效'
    })
  })

  it('allows empty query only for stop', () => {
    expect(parseFindInPageRequest('   ', 'next')).toEqual({
      ok: false,
      message: '查找关键字不能为空'
    })
    expect(parseFindInPageRequest('', 'stop')).toEqual({ ok: true, kind: 'stop' })
  })

  it('builds next and previous options', () => {
    expect(parseFindInPageRequest('hello', 'next')).toEqual({
      ok: true,
      kind: 'find',
      query: 'hello',
      options: { forward: true, findNext: true }
    })
    expect(parseFindInPageRequest('hello', 'previous')).toEqual({
      ok: true,
      kind: 'find',
      query: 'hello',
      options: { forward: false, findNext: true }
    })
  })
})

describe('findResultFromEvent', () => {
  it('ignores partial updates and normalizes finals', () => {
    expect(findResultFromEvent({ finalUpdate: false, activeMatchOrdinal: 1, matches: 3 })).toBe(
      null
    )
    expect(findResultFromEvent({ finalUpdate: true, activeMatchOrdinal: 2, matches: 4 })).toEqual({
      activeMatchOrdinal: 2,
      matches: 4
    })
    expect(findResultFromEvent({ finalUpdate: true })).toEqual(emptyFindMatch())
  })

  it('uses a two second timeout', () => {
    expect(FIND_IN_PAGE_TIMEOUT_MS).toBe(2000)
  })
})
