export const BROWSER_PARTITION = 'persist:browser'
export const REQUEST_FILTER_URLS = ['https://*/*'] as const
const BLOCKED_URL_MARKER = 'blocked.example'

export function shouldCancelFilteredRequest(url: string): boolean {
  return url.includes(BLOCKED_URL_MARKER)
}

export function certificateVerifyVerdict(allowInsecure: boolean): 0 | -2 {
  return allowInsecure ? 0 : -2
}

export function resolveAllowInsecureCerts(
  requested: boolean,
  isPackaged: boolean
): { ok: true; allow: boolean } | { ok: false; code: 'E_PLATFORM' } {
  if (requested && isPackaged) {
    return { ok: false, code: 'E_PLATFORM' }
  }
  return { ok: true, allow: requested }
}
