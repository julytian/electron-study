import { onMounted, onUnmounted, readonly, ref, shallowRef } from 'vue'
import type { DeepReadonly, Ref } from 'vue'
import { invokeIpc } from './useIpc'

export interface PortChatMessage {
  side: 'left' | 'right'
  text: string
}

function asPortMessage(detail: unknown): PortChatMessage | null {
  if (typeof detail === 'string' && detail.trim()) {
    return { side: 'left', text: detail }
  }
  if (!detail || typeof detail !== 'object') return null
  const record = detail as { side?: unknown; text?: unknown }
  if ((record.side !== 'left' && record.side !== 'right') || typeof record.text !== 'string') {
    return null
  }
  return { side: record.side, text: record.text }
}

export function useLabPort(side: 'left' | 'right'): {
  messages: DeepReadonly<Ref<PortChatMessage[]>>
  draft: Ref<string>
  send: () => Promise<void>
} {
  const messages = ref<PortChatMessage[]>([])
  const draft = shallowRef('')

  function append(payload: PortChatMessage): void {
    messages.value = [...messages.value, payload]
  }

  async function send(): Promise<void> {
    const text = draft.value.trim()
    if (!text) return
    const payload: PortChatMessage = { side, text }
    const port = window.__labPort
    if (port) {
      port.postMessage(payload)
      append(payload)
    } else {
      await invokeIpc('port:send', side, text)
    }
    draft.value = ''
  }

  const onLabPort = (event: Event): void => {
    const payload = asPortMessage((event as CustomEvent).detail)
    if (payload) append(payload)
  }

  let offFallback: (() => void) | undefined

  onMounted(() => {
    window.addEventListener('lab-port', onLabPort)
    offFallback = window.api.on('port:message', (payload) => {
      append(payload)
    })
  })

  onUnmounted(() => {
    window.removeEventListener('lab-port', onLabPort)
    offFallback?.()
  })

  return { messages: readonly(messages), draft, send }
}
