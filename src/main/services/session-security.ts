import { app, shell, type Session } from 'electron'
import { isAllowedExternalUrl } from '../../shared/external-url'
import { cspHeader, shouldAttachCsp } from '../../shared/csp'
import {
  permissionsPolicyHeader,
  shouldAttachPermissionsPolicy
} from '../../shared/permissions-policy'
import { isSessionPermissionAllowed, type SessionSecurityKind } from './session-permissions'
import { isRendererNavigationAllowed } from '../windows/window-policy'

const sessionKinds = new WeakMap<Session, SessionSecurityKind>()
let webContentsHooked = false
let appIsDev = false

function ensureWebContentsHook(): void {
  if (webContentsHooked) return
  webContentsHooked = true
  app.on('web-contents-created', (_event, contents) => {
    const kind = sessionKinds.get(contents.session)
    if (!kind) return
    contents.on('will-attach-webview', (event) => {
      event.preventDefault()
    })
    if (kind !== 'app') return
    contents.on('will-redirect', (event, url) => {
      const current = contents.getURL()
      if (isRendererNavigationAllowed(current, url, appIsDev)) return
      event.preventDefault()
      if (isAllowedExternalUrl(url)) void shell.openExternal(url)
    })
  })
}

function attachDeniedDeviceHandlers(ses: Session): void {
  try {
    ses.setDisplayMediaRequestHandler((_request, callback) => {
      callback({})
    })
  } catch (error) {
    console.error(error)
  }
  try {
    ses.setDevicePermissionHandler(() => false)
  } catch (error) {
    console.error(error)
  }
}

export function attachSessionSecurity(
  ses: Session,
  kind: SessionSecurityKind,
  options: { packaged: boolean; isDev: boolean }
): void {
  sessionKinds.set(ses, kind)
  if (kind === 'app') appIsDev = options.isDev

  ses.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(isSessionPermissionAllowed(kind, permission))
  })
  ses.setPermissionCheckHandler((_webContents, permission) => {
    return isSessionPermissionAllowed(kind, permission)
  })
  attachDeniedDeviceHandlers(ses)

  const attachHeaders =
    shouldAttachCsp(kind, options.packaged) ||
    shouldAttachPermissionsPolicy(kind, options.packaged)
  if (attachHeaders) {
    ses.webRequest.onHeadersReceived((details, callback) => {
      if (details.resourceType !== 'mainFrame' && details.resourceType !== 'subFrame') {
        callback({})
        return
      }
      const headers = { ...(details.responseHeaders ?? {}) }
      if (shouldAttachCsp(kind, options.packaged)) {
        headers['Content-Security-Policy'] = [cspHeader()]
      }
      if (shouldAttachPermissionsPolicy(kind, options.packaged)) {
        headers['Permissions-Policy'] = [permissionsPolicyHeader()]
      }
      callback({ responseHeaders: headers })
    })
  }

  ensureWebContentsHook()
}
