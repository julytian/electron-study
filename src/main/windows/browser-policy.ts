export const BROWSER_SIDER_WIDTH = 240
export const BROWSER_TOOLBAR_HEIGHT = 72

export type BrowserUrlOk = { ok: true; url: string }
export type BrowserUrlErr = { ok: false; message: string }

export function normalizeBrowserUrl(input: string): BrowserUrlOk | BrowserUrlErr {
  const trimmed = input.trim()
  if (!trimmed) {
    return { ok: false, message: 'URL 不能为空' }
  }

  const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`

  let parsed: URL
  try {
    parsed = new URL(candidate)
  } catch {
    return { ok: false, message: 'URL 无效' }
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, message: '仅允许 https 地址' }
  }

  return { ok: true, url: parsed.href }
}

export function isBrowserRoute(url: string): boolean {
  const hashIndex = url.indexOf('#')
  const hash = hashIndex >= 0 ? url.slice(hashIndex + 1) : url
  const path = hash.split('?')[0]
  return path === '/browser' || path.startsWith('/browser/')
}

export function browserViewBounds(windowSize: { width: number; height: number }): {
  x: number
  y: number
  width: number
  height: number
} {
  return {
    x: BROWSER_SIDER_WIDTH,
    y: BROWSER_TOOLBAR_HEIGHT,
    width: Math.max(0, windowSize.width - BROWSER_SIDER_WIDTH),
    height: Math.max(0, windowSize.height - BROWSER_TOOLBAR_HEIGHT)
  }
}
