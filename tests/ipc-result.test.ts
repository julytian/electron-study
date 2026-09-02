import { describe, expect, it } from 'vitest'
import { errorCodes, ipcError, ipcOk } from '../src/shared/ipc-result'

describe('ipc-result', () => {
  it('wraps success payload', () => {
    expect(ipcOk(1)).toEqual({ ok: true, data: 1 })
  })

  it('wraps typed error', () => {
    expect(ipcError(errorCodes.PATH, 'escape')).toEqual({
      ok: false,
      error: { code: 'E_PATH', message: 'escape' }
    })
  })
})
