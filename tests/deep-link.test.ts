import { describe, expect, it } from 'vitest'
import { parseDeepLink } from '../src/shared/deep-link'

describe('parseDeepLink', () => {
  it('parses note id', () => {
    expect(parseDeepLink('electron-lab://note/12')).toEqual({
      kind: 'note',
      id: 12
    })
  })

  it('rejects other protocols', () => {
    expect(parseDeepLink('https://example.com')).toBeNull()
  })

  it('rejects non-numeric note id', () => {
    expect(parseDeepLink('electron-lab://note/abc')).toBeNull()
  })
})
