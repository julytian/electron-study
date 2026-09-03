export function portMessageTargetOrigin(locationOrigin: string): string {
  const trimmed = locationOrigin.trim()
  if (!trimmed || trimmed === '*') return 'null'
  return trimmed
}

export function isTrustedPortMessageOrigin(
  eventOrigin: string,
  locationOrigin: string
): boolean {
  if (eventOrigin === '*' || locationOrigin === '*') return false
  return eventOrigin === portMessageTargetOrigin(locationOrigin)
}

export function shouldAcceptLabPortMessage(data: unknown, portsLength: number): boolean {
  return data === 'port' && portsLength > 0
}
