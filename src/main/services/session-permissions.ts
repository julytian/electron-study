const DEFAULT_SESSION_PERMISSIONS = new Set([
  'notifications',
  'clipboard-read',
  'clipboard-sanitized-write',
  'media',
  'display-capture',
  'fullscreen'
])

export function isDefaultSessionPermissionAllowed(permission: string): boolean {
  return DEFAULT_SESSION_PERMISSIONS.has(permission)
}
