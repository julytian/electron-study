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
