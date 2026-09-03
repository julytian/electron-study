import { onMounted, ref, watch, type Ref } from 'vue'
import type { Note } from '@shared/models'
import { invokeIpc } from './useIpc'
import { useAppStore } from '../stores/app'

interface UseNotes {
  notes: Ref<Note[]>
  current: Ref<Note | null>
  keyword: Ref<string>
  refresh: () => Promise<void>
  open: (id: number) => Promise<void>
  create: () => Promise<void>
  save: () => Promise<void>
  remove: (id: number) => Promise<void>
}

function noteSnapshot(note: Note | null): string | null {
  if (!note) return null
  return JSON.stringify({
    id: note.id,
    title: note.title,
    body: note.body,
    pinned: note.pinned,
    isEncrypted: note.isEncrypted
  })
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
    if (!current.value || cleanSnapshot === null) {
      app.notesDirty = false
      return
    }
    app.notesDirty = noteSnapshot(current.value) !== cleanSnapshot
  }

  async function refresh(): Promise<void> {
    notes.value = await invokeIpc('notes:list', keyword.value || undefined)
  }

  async function open(id: number): Promise<void> {
    current.value = await invokeIpc('notes:get', id)
    markClean(current.value)
  }

  async function create(): Promise<void> {
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

  return { notes, current, keyword, refresh, open, create, save, remove }
}
