export const errorCodes = {
  VALIDATION: 'E_VALIDATION',
  PATH: 'E_PATH',
  NOT_FOUND: 'E_NOT_FOUND',
  ENCRYPT: 'E_ENCRYPT',
  NETWORK: 'E_NETWORK',
  UPDATE: 'E_UPDATE',
  PLATFORM: 'E_PLATFORM'
} as const

export type ErrorCode = (typeof errorCodes)[keyof typeof errorCodes]

export type IpcOk<T> = { ok: true; data: T }
export type IpcErr = { ok: false; error: { code: ErrorCode; message: string } }
export type IpcResult<T> = IpcOk<T> | IpcErr

export function ipcOk<T>(data: T): IpcOk<T> {
  return { ok: true, data }
}

export function ipcError(code: ErrorCode, message: string): IpcErr {
  return { ok: false, error: { code, message } }
}
