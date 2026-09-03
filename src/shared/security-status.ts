import { ELECTRON_FUSES } from './electron-fuses'

export function formatSecurityStatus(packaged: boolean): string {
  const parts = [
    `packaged=${packaged}`,
    `cspSession=${packaged}`,
    'permissionCheck=true',
    ...Object.entries(ELECTRON_FUSES).map(([key, value]) => `fuses.${key}=${value}`)
  ]
  return parts.join('; ')
}
