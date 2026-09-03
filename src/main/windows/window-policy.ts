export function withHash(currentUrl: string, hash: string): string {
  const url = new URL(currentUrl)
  const path = hash.startsWith('#') ? hash.slice(1) : hash
  url.hash = path.startsWith('/') ? path : `/${path}`
  return url.toString()
}

export function isSameRendererDocument(current: string, next: string): boolean {
  try {
    const a = new URL(current)
    const b = new URL(next)
    return a.protocol === b.protocol && a.host === b.host && a.pathname === b.pathname
  } catch {
    return false
  }
}

export function shouldHideToTray(options: {
  closeToTray: boolean
  platform: NodeJS.Platform
  quitting: boolean
}): boolean {
  return options.closeToTray && options.platform !== 'darwin' && !options.quitting
}
