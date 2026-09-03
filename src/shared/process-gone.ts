export const DEFAULT_RENDERER_RELOAD_LIMIT = 2

export interface ReloadRendererInput {
  isMainWindow: boolean
  reason: string
  consecutiveReloads: number
  maxReloads?: number
}

export function shouldReloadRenderer(input: ReloadRendererInput): boolean {
  if (!input.isMainWindow) return false
  if (input.reason === 'clean-exit') return false
  const max = input.maxReloads ?? DEFAULT_RENDERER_RELOAD_LIMIT
  return input.consecutiveReloads < max
}

export function formatRenderProcessGoneMessage(input: {
  reason: string
  exitCode: number | string
  isMainWindow: boolean
  reload: boolean
  count: number
}): string {
  return `reason=${input.reason} exitCode=${input.exitCode} main=${input.isMainWindow} reload=${input.reload} count=${input.count}`
}

export function formatChildProcessGoneMessage(input: {
  type: string
  reason: string
  exitCode: number | string
}): string {
  return `type=${input.type} reason=${input.reason} exitCode=${input.exitCode}`
}
