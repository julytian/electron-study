import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { invokeIpc } from './useIpc'

interface UseFiles {
  path: Ref<string | null>
  content: Ref<string>
  contentLoaded: Ref<boolean>
  hasPath: ComputedRef<boolean>
  open: () => Promise<void>
  save: () => Promise<void>
  showInFolder: () => Promise<void>
  trash: () => Promise<void>
  startDrag: (event: DragEvent) => Promise<void>
}

export function useFiles(): UseFiles {
  const path = ref<string | null>(null)
  const content = ref('')
  const contentLoaded = ref(false)
  const hasPath = computed(() => Boolean(path.value))

  async function open(): Promise<void> {
    const result = await invokeIpc('files:open')
    if (!result) return
    path.value = result.path
    if (result.content !== undefined) {
      content.value = result.content
      contentLoaded.value = true
      return
    }
    content.value = ''
    contentLoaded.value = false
  }

  async function save(): Promise<void> {
    const result = await invokeIpc('files:save', content.value)
    if (!result) return
    path.value = result.path
    contentLoaded.value = true
  }

  async function showInFolder(): Promise<void> {
    if (!path.value) return
    await invokeIpc('files:show-in-folder', path.value)
  }

  async function trash(): Promise<void> {
    if (!path.value) return
    await invokeIpc('files:trash', path.value)
    path.value = null
    content.value = ''
    contentLoaded.value = false
  }

  async function startDrag(event: DragEvent): Promise<void> {
    event.preventDefault()
    if (!path.value) return
    await invokeIpc('files:start-drag', path.value)
  }

  return { path, content, contentLoaded, hasPath, open, save, showInFolder, trash, startDrag }
}
