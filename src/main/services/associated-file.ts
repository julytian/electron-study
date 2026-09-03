import { resolve } from 'node:path'
import { MAX_TEXT_BYTES } from './files'
import { isMarkdownPath, noteTitleFromMarkdownPath } from './protocol-url'

export interface AssociatedFileFs {
  statSize(filePath: string): number
  readText(filePath: string): string
}

export interface AssociatedFileNotes {
  create(input: { title: string; body: string }): { id: number }
}

export interface AssociatedFileDeps {
  remember: (absPath: string) => string
  fs: AssociatedFileFs
  notes: AssociatedFileNotes
  resolvePath?: (filePath: string) => string
  maxTextBytes?: number
}

export type AssociatedFileResult =
  | { kind: 'note'; path: string; id: number }
  | { kind: 'recent'; path: string }

export function processAssociatedFileContent(
  filePath: string,
  deps: AssociatedFileDeps
): AssociatedFileResult {
  const abs = (deps.resolvePath ?? resolve)(filePath)
  const remembered = deps.remember(abs)
  const limit = deps.maxTextBytes ?? MAX_TEXT_BYTES

  if (isMarkdownPath(abs) && deps.fs.statSize(abs) <= limit) {
    const note = deps.notes.create({
      title: noteTitleFromMarkdownPath(abs),
      body: deps.fs.readText(abs)
    })
    return { kind: 'note', path: remembered, id: note.id }
  }

  return { kind: 'recent', path: remembered }
}
