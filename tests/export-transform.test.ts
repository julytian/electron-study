import { describe, expect, it } from 'vitest'
import { transformExportPayload } from '../src/main/utility/export-transform'

describe('transformExportPayload', () => {
  it('uppercases, repeats by times, and appends hash-length', () => {
    expect(transformExportPayload({ text: 'ab', times: 2 })).toEqual({ text: 'ABAB#4' })
  })

  it('defaults times to 1', () => {
    expect(transformExportPayload({ text: 'hi' })).toEqual({ text: 'HI#2' })
  })
})
