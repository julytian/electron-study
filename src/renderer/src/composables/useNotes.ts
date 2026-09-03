import { onMounted, ref, type Ref } from 'vue'
import type { Note } from '@shared/models'
import { invokeIpc } from './useIpc'

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

export function useNotes(): UseNotes {
  const notes = ref<Note[]>([])
  const current = ref<Note | null>(null)
  const keyword = ref('')

  async function refresh(): Promise<void> {
    notes.value = await invokeIpc('notes:list', keyword.value || undefined)
  }

  async function open(id: number): Promise<void> {
    current.value = await invokeIpc('notes:get', id)
  }

  async function create(): Promise<void> {
    const note = await invokeIpc('notes:create', { title: '未命名', body: '' })
    await refresh()
    current.value = note
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
    await refresh()
  }

  async function remove(id: number): Promise<void> {
    await invokeIpc('notes:delete', id)
    if (current.value?.id === id) current.value = null
    await refresh()
  }

  onMounted(() => {
    void refresh()
  })

  return { notes, current, keyword, refresh, open, create, save, remove }
}
