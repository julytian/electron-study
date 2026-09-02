export type DeepLink = { kind: 'note'; id: number }

export function parseDeepLink(url: string): DeepLink | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== 'electron-lab:') return null
  const route = [parsed.hostname, parsed.pathname.replace(/^\/+/, '')].filter(Boolean).join('/')
  const match = route.match(/^(note)\/(\d+)$/)
  if (!match) return null
  return { kind: 'note', id: Number(match[2]) }
}
