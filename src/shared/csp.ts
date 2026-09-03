export const CSP_HEADER =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:"

export function cspHeader(): string {
  return CSP_HEADER
}

export function shouldAttachCsp(kind: 'app' | 'browser', packaged: boolean): boolean {
  return kind === 'app' && packaged
}
