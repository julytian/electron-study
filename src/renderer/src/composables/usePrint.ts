import { shallowRef, type ShallowRef } from 'vue'
import { invokeIpc } from './useIpc'

interface UsePrint {
  path: ShallowRef<string>
  busy: ShallowRef<boolean>
  exportPdf: () => Promise<void>
}

export function usePrint(): UsePrint {
  const path = shallowRef('')
  const busy = shallowRef(false)

  async function exportPdf(): Promise<void> {
    if (busy.value) return
    busy.value = true
    try {
      const result = await invokeIpc('print:pdf')
      path.value = result.path
      await invokeIpc('files:show-in-folder', result.path)
    } finally {
      busy.value = false
    }
  }

  return { path, busy, exportPdf }
}
