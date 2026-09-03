import type { IpcResult } from './ipc-result'
import type {
  AppInfo,
  AppSettings,
  ClipboardItem,
  ClipboardKind,
  DownloadRecord,
  LabEvent,
  Note,
  RecentFile,
  ThemeMode,
  UpdaterStatus
} from './models'

export const invokeChannels = {
  'app:get-info': true,
  'conf:get': true,
  'conf:set': true,
  'db:status': true,
  'db:export': true,
  'db:clear': true,
  'shell:open-path': true,
  'shell:open-external': true,
  'shell:open-logs': true,
  'notes:list': true,
  'notes:get': true,
  'notes:create': true,
  'notes:update': true,
  'notes:delete': true,
  'clipboard:read': true,
  'clipboard:write': true,
  'clipboard:history': true,
  'clipboard:clear-history': true,
  'clipboard:restore': true,
  'clipboard:delete': true,
  'files:open': true,
  'files:save': true,
  'files:show-in-folder': true,
  'files:trash': true,
  'files:start-drag': true,
  'files:add-recent': true,
  'files:recent': true,
  'files:open-recent': true,
  'files:forget': true,
  'capture:sources': true,
  'capture:save': true,
  'downloads:list': true,
  'downloads:start': true,
  'downloads:pause': true,
  'downloads:resume': true,
  'downloads:cancel': true,
  'print:pdf': true,
  'system:notify': true,
  'system:get-power': true,
  'system:set-theme': true,
  'system:set-login': true,
  'window:create-child': true,
  'window:create-float': true,
  'window:set-progress': true,
  'window:set-fullscreen': true,
  'window:set-overlay': true,
  'port:create-pair': true,
  'port:send': true,
  'browser:create': true,
  'browser:navigate': true,
  'browser:go': true,
  'network:set-proxy': true,
  'network:set-filter': true,
  'network:set-insecure-certs': true,
  'protocol:register': true,
  'updater:check': true,
  'updater:download': true,
  'updater:install': true,
  'updater:mock': true,
  'metrics:get': true,
  'lab:run': true,
  'lab:events': true
} as const

export type InvokeChannel = keyof typeof invokeChannels

export interface InvokeMap {
  'app:get-info': { args: []; result: AppInfo }
  'conf:get': { args: []; result: AppSettings }
  'conf:set': { args: [patch: Partial<AppSettings>]; result: AppSettings }
  'db:status': { args: []; result: { ready: boolean; path: string } }
  'db:export': { args: []; result: { path: string } }
  'db:clear': { args: []; result: null }
  'shell:open-path': { args: [target: string]; result: null }
  'shell:open-external': { args: [url: string]; result: null }
  'shell:open-logs': { args: []; result: null }
  'notes:list': { args: [query?: string]; result: Note[] }
  'notes:get': { args: [id: number]; result: Note }
  'notes:create': {
    args: [input: { title: string; body: string; encrypted?: boolean }]
    result: Note
  }
  'notes:update': {
    args: [
      input: { id: number; title?: string; body?: string; pinned?: boolean; encrypted?: boolean }
    ]
    result: Note
  }
  'notes:delete': { args: [id: number]; result: null }
  'clipboard:read': { args: []; result: { text: string; html: string; hasImage: boolean } }
  'clipboard:write': {
    args: [input: { kind: ClipboardKind; text?: string; html?: string }]
    result: ClipboardItem
  }
  'clipboard:history': { args: []; result: ClipboardItem[] }
  'clipboard:clear-history': { args: []; result: null }
  'clipboard:restore': { args: [id: number]; result: null }
  'clipboard:delete': { args: [id: number]; result: null }
  'files:open': { args: []; result: { path: string; content?: string } | null }
  'files:save': { args: [content: string]; result: { path: string } | null }
  'files:show-in-folder': { args: [target: string]; result: null }
  'files:trash': { args: [target: string]; result: null }
  'files:start-drag': { args: [target: string]; result: null }
  'files:add-recent': { args: [target: string]; result: null }
  'files:recent': { args: []; result: RecentFile[] }
  'files:open-recent': { args: [target: string]; result: { path: string; content?: string } }
  'files:forget': { args: [target?: string]; result: null }
  'capture:sources': {
    args: []
    result: Array<{ id: string; name: string; thumbnailDataUrl: string }>
  }
  'capture:save': { args: [dataUrl: string]; result: { path: string } }
  'downloads:list': { args: []; result: DownloadRecord[] }
  'downloads:start': { args: [url: string]; result: DownloadRecord }
  'downloads:pause': { args: [id: number]; result: null }
  'downloads:resume': { args: [id: number]; result: null }
  'downloads:cancel': { args: [id: number]; result: null }
  'print:pdf': { args: []; result: { path: string } }
  'system:notify': { args: [input: { title: string; body: string; route?: string }]; result: null }
  'system:get-power': {
    args: []
    result: { onBattery: boolean; idleState: string }
  }
  'system:set-theme': { args: [theme: ThemeMode]; result: null }
  'system:set-login': { args: [enabled: boolean]; result: null }
  'window:create-child': { args: []; result: null }
  'window:create-float': { args: []; result: null }
  'window:set-progress': { args: [value: number]; result: null }
  'window:set-fullscreen': { args: [flag: boolean]; result: null }
  'window:set-overlay': { args: [enabled: boolean]; result: null }
  'port:create-pair': { args: []; result: null }
  'port:send': { args: [side: 'left' | 'right', text: string]; result: null }
  'browser:create': { args: []; result: null }
  'browser:navigate': { args: [url: string]; result: null }
  'browser:go': { args: [action: 'back' | 'forward' | 'reload']; result: null }
  'network:set-proxy': { args: [rules: string]; result: null }
  'network:set-filter': { args: [enabled: boolean]; result: null }
  'network:set-insecure-certs': { args: [enabled: boolean]; result: null }
  'protocol:register': { args: []; result: { ok: boolean } }
  'updater:check': { args: []; result: { status: UpdaterStatus; version?: string } }
  'updater:download': { args: []; result: null }
  'updater:install': { args: []; result: null }
  'updater:mock': { args: [status: UpdaterStatus]; result: null }
  'metrics:get': {
    args: []
    result: Array<{ pid: number; type: string; cpu: number; memory: number }>
  }
  'lab:run': { args: [module: string, action: string]; result: { message: string } }
  'lab:events': { args: []; result: LabEvent[] }
}

export const eventChannels = {
  'updater:progress': true,
  'updater:status': true,
  'download:updated': true,
  'deep-link:open': true,
  'theme:changed': true,
  'power:changed': true,
  'port:message': true,
  'browser:nav': true
} as const

export type EventChannel = keyof typeof eventChannels

export interface EventMap {
  'updater:progress': { percent: number }
  'updater:status': { status: UpdaterStatus; version?: string; message?: string }
  'download:updated': DownloadRecord
  'deep-link:open': { kind: 'note'; id: number }
  'theme:changed': { theme: ThemeMode }
  'power:changed': { onBattery: boolean }
  'port:message': { side: 'left' | 'right'; text: string }
  'browser:nav': { url: string; canBack: boolean; canForward: boolean }
}

export type InvokeFn = <C extends InvokeChannel>(
  channel: C,
  ...args: InvokeMap[C]['args']
) => Promise<IpcResult<InvokeMap[C]['result']>>

export type OnFn = <C extends EventChannel>(
  channel: C,
  listener: (payload: EventMap[C]) => void
) => () => void
