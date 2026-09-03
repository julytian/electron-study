export function isAcceleratorShape(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  return trimmed.includes('+')
}
