import type { Note } from './models'

export type UnsavedChoice = 'save' | 'discard' | 'cancel'

export function isDirtySnapshot(current: string | null, clean: string | null): boolean {
  if (current === null || clean === null) return false
  return current !== clean
}

export function noteSnapshot(note: Note | null): string | null {
  if (!note) return null
  return JSON.stringify({
    id: note.id,
    title: note.title,
    body: note.body,
    pinned: note.pinned,
    isEncrypted: note.isEncrypted
  })
}

export async function runUnsavedGuard(options: {
  dirty: boolean
  ask: () => Promise<UnsavedChoice>
  save: () => Promise<boolean>
  discard?: () => void | Promise<void>
}): Promise<boolean> {
  if (!options.dirty) return true
  const choice = await options.ask()
  if (choice === 'cancel') return false
  if (choice === 'save') return options.save()
  await options.discard?.()
  return true
}
