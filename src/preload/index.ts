import { contextBridge, ipcRenderer } from 'electron'
import {
  eventChannels,
  invokeChannels,
  type EventChannel,
  type InvokeChannel
} from '../shared/ipc'

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
