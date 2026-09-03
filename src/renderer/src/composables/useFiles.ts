import type { RecentFile } from '@shared/models'
import { isDirtySnapshot, runUnsavedGuard } from '@shared/unsaved'
import { computed, onMounted, ref, type ComputedRef, type Ref } from 'vue'
import { invokeIpc } from './useIpc'
import { askUnsaved } from './useUnsavedPrompt'

interface UseFiles {
  path: Ref<string | null>
  content: Ref<string>
  contentLoaded: Ref<boolean>
  dirty: ComputedRef<boolean>
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
  confirmProceed: () => Promise<boolean>
}

export function useFiles(): UseFiles {
  const path = ref<string | null>(null)
  const content = ref('')
  const contentLoaded = ref(false)
  const cleanContent = ref<string | null>(null)
  const recents = ref<RecentFile[]>([])
  const hasPath = computed(() => Boolean(path.value))
  const dirty = computed(
    () => contentLoaded.value && isDirtySnapshot(content.value, cleanContent.value)
  )

  function markClean(): void {
    cleanContent.value = contentLoaded.value ? content.value : null
  }

  async function persistSave(): Promise<boolean> {
    const result = await invokeIpc('files:save', content.value)
    if (!result) return false
    path.value = result.path
    contentLoaded.value = true
    markClean()
    await refreshRecents()
    return true
  }

  async function confirmProceed(): Promise<boolean> {
    return runUnsavedGuard({
      dirty: dirty.value,
      ask: () => askUnsaved(),
      save: persistSave
    })
  }

  async function refreshRecents(): Promise<void> {
    recents.value = await invokeIpc('files:recent')
  }

  function applyLoaded(result: { path: string; content?: string }): void {
    path.value = result.path
    if (result.content !== undefined) {
      content.value = result.content
      contentLoaded.value = true
    } else {
      content.value = ''
      contentLoaded.value = false
    }
    markClean()
  }

  async function open(): Promise<void> {
    if (!(await confirmProceed())) return
    const result = await invokeIpc('files:open')
    if (!result) return
    applyLoaded(result)
    await refreshRecents()
  }

  async function save(): Promise<void> {
    await persistSave()
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
    cleanContent.value = null
    await refreshRecents()
  }

  async function startDrag(event: DragEvent): Promise<void> {
    event.preventDefault()
    if (!path.value) return
    await invokeIpc('files:start-drag', path.value)
  }

  async function openRecent(target: string): Promise<void> {
    if (!(await confirmProceed())) return
    try {
      const result = await invokeIpc('files:open-recent', target)
      applyLoaded(result)
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
    dirty,
    hasPath,
    recents,
    open,
    save,
    showInFolder,
    trash,
    startDrag,
    refreshRecents,
    openRecent,
    forget,
    confirmProceed
  }
}
