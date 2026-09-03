import { contextBridge, ipcRenderer } from 'electron'
import { eventChannels, invokeChannels, type EventChannel, type InvokeChannel } from '../shared/ipc'

contextBridge.exposeInMainWorld('api', {
  invoke(channel: string, ...args: unknown[]) {
    if (!(channel in invokeChannels)) {
      return Promise.reject(new Error(`Blocked invoke: ${channel}`))
    }
    return ipcRenderer.invoke(channel as InvokeChannel, ...args)
  },
  on(channel: string, listener: (payload: unknown) => void) {
    if (!(channel in eventChannels)) {
      throw new Error(`Blocked event: ${channel}`)
    }
    const wrapped = (_e: Electron.IpcRendererEvent, payload: unknown): void => {
      listener(payload)
    }
    ipcRenderer.on(channel as EventChannel, wrapped)
    return () => ipcRenderer.removeListener(channel as EventChannel, wrapped)
  }
})

window.addEventListener('message', (event) => {
  if (event.data !== 'port') return
  const port = event.ports[0]
  port.onmessage = (msg) => {
    window.dispatchEvent(new CustomEvent('lab-port', { detail: msg.data }))
  }
  ;(window as unknown as { __labPort?: MessagePort }).__labPort = port
})

// webContents.postMessage 走 ipcRenderer；再转到主世界，渲染进程才能用 __labPort
ipcRenderer.on('port', (event) => {
  if (event.ports.length === 0) return
  window.postMessage('port', '*', event.ports)
})
