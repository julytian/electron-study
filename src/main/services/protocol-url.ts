import { basename } from 'node:path'

export const PROTOCOL = 'electron-lab'

export function extractUrlFromArgv(argv: string[]): string | null {
  return argv.find((arg) => arg.startsWith(`${PROTOCOL}://`)) ?? null
}

export function isMarkdownPath(filePath: string): boolean {
  return /\.md$/i.test(filePath)
}

export function noteTitleFromMarkdownPath(filePath: string): string {
  return basename(filePath).replace(/\.md$/i, '')
}

function isFlagOrDot(arg: string): boolean {
  return arg === '.' || arg.startsWith('--')
}

function isProtocolUrl(arg: string): boolean {
  return arg.startsWith(`${PROTOCOL}://`)
}

function isElectronEntryScript(arg: string): boolean {
  return /\.(?:js|mjs|cjs)$/i.test(arg)
}

function isAbsolutePath(arg: string): boolean {
  return arg.startsWith('/') || arg.startsWith('\\\\') || /^[a-zA-Z]:[\\/]/.test(arg)
}

function looksLikeFilePath(arg: string): boolean {
  if (isProtocolUrl(arg) || isFlagOrDot(arg) || isElectronEntryScript(arg)) return false
  return isMarkdownPath(arg) || isAbsolutePath(arg) || /[\\/]/.test(arg)
}

export function extractFileFromArgv(argv: string[]): string | null {
  const candidates = argv.slice(1).filter((arg) => !isFlagOrDot(arg) && !isProtocolUrl(arg))
  const markdown = candidates.find((arg) => isMarkdownPath(arg))
  if (markdown) return markdown
  return candidates.find(looksLikeFilePath) ?? null
}
