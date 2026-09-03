import { onMounted, ref, type Ref } from 'vue'
import type { ClipboardItem } from '@shared/models'
import { invokeIpc } from './useIpc'

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ')
}

export function imageCaption(imagePath: string | null): string {
  if (!imagePath) return ''
  const name = imagePath.split(/[/\\]/).pop()
  return name || '已保存图片'
}

export function itemDisplayText(item: ClipboardItem): string {
  if (item.text) return item.text
  if (item.html) return stripHtml(item.html)
  return ''
}

interface UseClipboard {
  items: Ref<ClipboardItem[]>
  draft: Ref<string>
  refresh: () => Promise<void>
  readSystem: () => Promise<void>
  writeText: () => Promise<void>
  clearHistory: () => Promise<void>
}

export function useClipboard(): UseClipboard {
  const items = ref<ClipboardItem[]>([])
  const draft = ref('')

  async function refresh(): Promise<void> {
    items.value = await invokeIpc('clipboard:history')
  }

  async function readSystem(): Promise<void> {
    await invokeIpc('clipboard:read')
    await refresh()
  }

  async function writeText(): Promise<void> {
    const text = draft.value
    if (!text) return
    await invokeIpc('clipboard:write', { kind: 'text', text })
    await refresh()
  }

  async function clearHistory(): Promise<void> {
    await invokeIpc('clipboard:clear-history')
    await refresh()
  }

  onMounted(() => {
    void refresh()
  })

  return { items, draft, refresh, readSystem, writeText, clearHistory }
}
