import path from 'node:path'

export function assertWithinRoot(target: string, root: string): string {
  const resolved = path.resolve(target)
  const normalizedRoot = path.resolve(root)
  const ok =
    resolved === normalizedRoot || resolved.startsWith(normalizedRoot + path.sep)
  if (!ok) {
    const error = new Error('E_PATH: Path escapes root')
    error.name = 'E_PATH'
    throw error
  }
  return resolved
}
