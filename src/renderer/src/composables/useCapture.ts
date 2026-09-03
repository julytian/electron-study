import { onMounted, ref, shallowRef } from 'vue'
import type { Ref, ShallowRef } from 'vue'
import { invokeIpc } from './useIpc'

export interface CaptureSource {
  id: string
  name: string
  thumbnailDataUrl: string
}

interface UseCapture {
  sources: Ref<CaptureSource[]>
  path: ShallowRef<string>
  busy: ShallowRef<boolean>
  refresh: () => Promise<void>
  save: (source: CaptureSource) => Promise<void>
}

export function useCapture(): UseCapture {
  const sources = ref<CaptureSource[]>([])
  const path = shallowRef('')
  const busy = shallowRef(false)

  async function refresh(): Promise<void> {
    busy.value = true
    try {
      sources.value = await invokeIpc('capture:sources')
    } finally {
      busy.value = false
    }
  }

  async function save(source: CaptureSource): Promise<void> {
    const result = await invokeIpc('capture:save', source.thumbnailDataUrl)
    path.value = result.path
  }

  onMounted(() => {
    void refresh()
  })

  return { sources, path, busy, refresh, save }
}
