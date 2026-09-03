export type SessionSecurityKind = 'app' | 'browser'

const DEFAULT_SESSION_PERMISSIONS = new Set([
  'notifications',
  'clipboard-read',
  'clipboard-sanitized-write',
  'media',
  'display-capture',
  'fullscreen'
])

export function isSessionPermissionAllowed(kind: SessionSecurityKind, permission: string): boolean {
  if (kind === 'browser') return false
  return DEFAULT_SESSION_PERMISSIONS.has(permission)
}

export function isDefaultSessionPermissionAllowed(permission: string): boolean {
  return isSessionPermissionAllowed('app', permission)
}
