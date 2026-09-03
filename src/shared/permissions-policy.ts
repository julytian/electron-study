export const PERMISSIONS_POLICY_HEADER =
  'geolocation=(), camera=(), microphone=(), payment=(), usb=(), serial=(), hid=(), bluetooth=(), display-capture=()'

export function permissionsPolicyHeader(): string {
  return PERMISSIONS_POLICY_HEADER
}

export function shouldAttachPermissionsPolicy(
  kind: 'app' | 'browser',
  packaged: boolean
): boolean {
  return kind === 'app' && packaged
}
