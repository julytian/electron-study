import type { RecentFile } from '@shared/models'
import { computed, onMounted, ref, type ComputedRef, type Ref } from 'vue'
import { invokeIpc } from './useIpc'

interface UseFiles {
  path: Ref<string | null>
  content: Ref<string>
  contentLoaded: Ref<boolean>
  hasPath: ComputedRef<boolean>
  recents: Ref<RecentFile[]>
  open: () => Promise<void>
  save: () => Promise<void>
  showInFolder: (target?: string) => Promise<void>
  trash: () => Promise<void>
  startDrag: (event: DragEvent) => Promise<void>
  refreshRecents: () => Promise<void>
  openRecent: (target: string) => Promise<void>
  forget: (target?: string) => Promise<void>
}

export function useFiles(): UseFiles {
  const path = ref<string | null>(null)
  const content = ref('')
  const contentLoaded = ref(false)
  const recents = ref<RecentFile[]>([])
  const hasPath = computed(() => Boolean(path.value))

  async function refreshRecents(): Promise<void> {
    recents.value = await invokeIpc('files:recent')
  }

  async function open(): Promise<void> {
    const result = await invokeIpc('files:open')
    if (!result) return
    path.value = result.path
    if (result.content !== undefined) {
      content.value = result.content
      contentLoaded.value = true
    } else {
      content.value = ''
      contentLoaded.value = false
    }
    await refreshRecents()
  }

  async function save(): Promise<void> {
    const result = await invokeIpc('files:save', content.value)
    if (!result) return
    path.value = result.path
    contentLoaded.value = true
    await refreshRecents()
  }

  async function showInFolder(target?: string): Promise<void> {
    const next = target ?? path.value
    if (!next) return
    await invokeIpc('files:show-in-folder', next)
  }

  async function trash(): Promise<void> {
    if (!path.value) return
    await invokeIpc('files:trash', path.value)
    path.value = null
    content.value = ''
    contentLoaded.value = false
    await refreshRecents()
  }

  async function startDrag(event: DragEvent): Promise<void> {
    event.preventDefault()
    if (!path.value) return
    await invokeIpc('files:start-drag', path.value)
  }

  async function openRecent(target: string): Promise<void> {
    try {
      const result = await invokeIpc('files:open-recent', target)
      path.value = result.path
      if (result.content !== undefined) {
        content.value = result.content
        contentLoaded.value = true
      } else {
        content.value = ''
        contentLoaded.value = false
      }
    } finally {
      await refreshRecents()
    }
  }

  async function forget(target?: string): Promise<void> {
    await invokeIpc('files:forget', target)
    await refreshRecents()
  }

  onMounted(refreshRecents)

  return {
    path,
    content,
    contentLoaded,
    hasPath,
    recents,
    open,
    save,
    showInFolder,
    trash,
    startDrag,
    refreshRecents,
    openRecent,
    forget
  }
}
