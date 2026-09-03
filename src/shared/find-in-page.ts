export const FIND_IN_PAGE_TIMEOUT_MS = 2000

export type FindInPageAction = 'next' | 'previous' | 'stop'

export type FindMatch = { activeMatchOrdinal: number; matches: number }

export type FindInPageParsed =
  | { ok: false; message: string }
  | { ok: true; kind: 'stop' }
  | { ok: true; kind: 'find'; query: string; options: { forward: boolean; findNext: true } }

export function emptyFindMatch(): FindMatch {
  return { activeMatchOrdinal: 0, matches: 0 }
}

export function parseFindInPageRequest(query: unknown, action: unknown): FindInPageParsed {
  if (action !== 'next' && action !== 'previous' && action !== 'stop') {
    return { ok: false, message: '查找动作无效' }
  }
  if (typeof query !== 'string') {
    return { ok: false, message: '查找关键字无效' }
  }
  if (action === 'stop') {
    return { ok: true, kind: 'stop' }
  }
  if (query.trim() === '') {
    return { ok: false, message: '查找关键字不能为空' }
  }
  return {
    ok: true,
    kind: 'find',
    query,
    options: { forward: action === 'next', findNext: true }
  }
}

export function findResultFromEvent(result: {
  finalUpdate?: boolean
  activeMatchOrdinal?: number
  matches?: number
}): FindMatch | null {
  if (!result.finalUpdate) return null
  return {
    activeMatchOrdinal: result.activeMatchOrdinal ?? 0,
    matches: result.matches ?? 0
  }
}
