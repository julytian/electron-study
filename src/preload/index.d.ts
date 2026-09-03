import type { InvokeFn, OnFn } from '../shared/ipc'

declare global {
  interface Window {
    api: {
      invoke: InvokeFn
      on: OnFn
    }
    __labPort?: MessagePort
  }
}

export {}
