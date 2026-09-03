import { session } from 'electron'
import {
  BROWSER_PARTITION,
  REQUEST_FILTER_URLS,
  certificateVerifyVerdict,
  resolveAllowInsecureCerts,
  shouldCancelFilteredRequest
} from './browser-network'

let browserSession: Electron.Session | null = null
let allowInsecureCerts = false

export function getBrowserSession(): Electron.Session {
  if (browserSession) return browserSession
  const ses = session.fromPartition(BROWSER_PARTITION)
  ses.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })
  ses.setCertificateVerifyProc((_request, callback) => {
    callback(certificateVerifyVerdict(allowInsecureCerts))
  })
  browserSession = ses
  return ses
}

export function setBrowserRequestFilter(enabled: boolean): void {
  const ses = getBrowserSession()
  if (!enabled) {
    ses.webRequest.onBeforeRequest(null)
    return
  }
  ses.webRequest.onBeforeRequest({ urls: [...REQUEST_FILTER_URLS] }, (details, callback) => {
    callback({ cancel: shouldCancelFilteredRequest(details.url) })
  })
}

export function setBrowserProxyRules(rules: string): Promise<void> {
  return getBrowserSession().setProxy({ proxyRules: rules })
}

export function setBrowserInsecureCerts(
  requested: boolean,
  isPackaged: boolean
): { ok: true; allow: boolean } | { ok: false; code: 'E_PLATFORM' } {
  const resolved = resolveAllowInsecureCerts(requested, isPackaged)
  if (!resolved.ok) {
    return resolved
  }
  allowInsecureCerts = resolved.allow
  getBrowserSession()
  return resolved
}
