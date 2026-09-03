export const TITLE_BAR_OVERLAY = {
  color: '#1677ff',
  symbolColor: '#fff',
  height: 36
} as const

export function isValidProgress(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
}

export function buildRendererLoad(
  hash: string,
  options: { isDev: boolean; rendererUrl?: string }
): { kind: 'url'; url: string } | { kind: 'file'; hash: string } {
  if (options.isDev && options.rendererUrl) {
    return { kind: 'url', url: `${options.rendererUrl}#${hash}` }
  }
  return { kind: 'file', hash }
}
