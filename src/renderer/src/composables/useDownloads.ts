import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import type { ComputedRef, Ref, ShallowRef } from 'vue'
import type { DownloadRecord, DownloadState } from '@shared/models'
import { invokeIpc } from './useIpc'

const STATE_LABEL: Record<DownloadState, string> = {
  progressing: '下载中',
  paused: '已暂停',
  completed: '已完成',
  cancelled: '已取消',
  interrupted: '已中断'
}

export function stateLabel(state: DownloadState): string {
  return STATE_LABEL[state]
}

export function progressText(item: DownloadRecord): string {
  if (item.total <= 0) return `${item.received} B`
  const percent = Math.min(100, Math.round((item.received / item.total) * 100))
  return `${percent}% · ${item.received} / ${item.total}`
}

interface UseDownloads {
  items: Ref<DownloadRecord[]>
  url: ShallowRef<string>
  busy: ShallowRef<boolean>
  canStart: ComputedRef<boolean>
  start: () => Promise<void>
  pause: (id: number) => Promise<void>
  resume: (id: number) => Promise<void>
  cancel: (id: number) => Promise<void>
}

export function useDownloads(): UseDownloads {
  const items = ref<DownloadRecord[]>([])
  const url = shallowRef('')
  const busy = shallowRef(false)
  const canStart = computed(() => Boolean(url.value.trim()) && !busy.value)

  function applyUpdate(record: DownloadRecord): void {
    const index = items.value.findIndex((item) => item.id === record.id)
    if (index >= 0) {
      const next = items.value.slice()
      next[index] = record
      items.value = next
      return
    }
    items.value = [record, ...items.value]
  }

  async function refresh(): Promise<void> {
    items.value = await invokeIpc('downloads:list')
  }

  async function start(): Promise<void> {
    const target = url.value.trim()
    if (!target || busy.value) return
    busy.value = true
    try {
      applyUpdate(await invokeIpc('downloads:start', target))
    } finally {
      busy.value = false
    }
  }

  async function pause(id: number): Promise<void> {
    await invokeIpc('downloads:pause', id)
  }

  async function resume(id: number): Promise<void> {
    await invokeIpc('downloads:resume', id)
  }

  async function cancel(id: number): Promise<void> {
    await invokeIpc('downloads:cancel', id)
  }

  let offUpdated: (() => void) | undefined

  onMounted(() => {
    offUpdated = window.api.on('download:updated', applyUpdate)
    void refresh()
  })

  onBeforeUnmount(() => {
    offUpdated?.()
  })

  return { items, url, busy, canStart, start, pause, resume, cancel }
}
