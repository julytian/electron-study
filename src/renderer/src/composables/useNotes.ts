import { onMounted, ref, watch, type Ref } from 'vue'
import type { Note } from '@shared/models'
import { isDirtySnapshot, noteSnapshot, runUnsavedGuard } from '@shared/unsaved'
import { invokeIpc } from './useIpc'
import { useAppStore } from '../stores/app'
import { askUnsaved } from './useUnsavedPrompt'

interface UseNotes {
  notes: Ref<Note[]>
  current: Ref<Note | null>
  keyword: Ref<string>
  refresh: () => Promise<void>
  open: (id: number) => Promise<void>
  create: () => Promise<void>
  save: () => Promise<void>
  remove: (id: number) => Promise<void>
  confirmProceed: () => Promise<boolean>
}

export function useNotes(): UseNotes {
  const notes = ref<Note[]>([])
  const current = ref<Note | null>(null)
  const keyword = ref('')
  const app = useAppStore()
  let cleanSnapshot: string | null = null

  function markClean(note: Note | null): void {
    cleanSnapshot = noteSnapshot(note)
    app.notesDirty = false
  }

  function syncDirty(): void {
    app.notesDirty = isDirtySnapshot(noteSnapshot(current.value), cleanSnapshot)
  }

  async function confirmProceed(): Promise<boolean> {
    return runUnsavedGuard({
      dirty: app.notesDirty,
      ask: () => askUnsaved(),
      save: async () => {
        if (!current.value) return true
        await save()
        return true
      }
    })
  }

  async function refresh(): Promise<void> {
    notes.value = await invokeIpc('notes:list', keyword.value || undefined)
  }

  async function open(id: number): Promise<void> {
    if (current.value?.id !== id) {
      if (!(await confirmProceed())) return
    }
    current.value = await invokeIpc('notes:get', id)
    markClean(current.value)
  }

  async function create(): Promise<void> {
    if (!(await confirmProceed())) return
    const note = await invokeIpc('notes:create', { title: '未命名', body: '' })
    await refresh()
    current.value = note
    markClean(note)
  }

  async function save(): Promise<void> {
    if (!current.value) return
    current.value = await invokeIpc('notes:update', {
      id: current.value.id,
      title: current.value.title,
      body: current.value.body,
      encrypted: current.value.isEncrypted,
      pinned: current.value.pinned
    })
    markClean(current.value)
    await refresh()
  }

  async function remove(id: number): Promise<void> {
    await invokeIpc('notes:delete', id)
    if (current.value?.id === id) {
      current.value = null
      markClean(null)
    }
    await refresh()
  }

  watch(
    () =>
      current.value
        ? {
            title: current.value.title,
            body: current.value.body,
            pinned: current.value.pinned,
            isEncrypted: current.value.isEncrypted
          }
        : null,
    () => {
      syncDirty()
    }
  )

  onMounted(() => {
    void refresh()
  })

  return { notes, current, keyword, refresh, open, create, save, remove, confirmProceed }
}
