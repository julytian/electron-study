export type ThemeMode = 'system' | 'light' | 'dark'
export type ClipboardKind = 'text' | 'html' | 'image'
export type DownloadState =
  | 'progressing'
  | 'completed'
  | 'cancelled'
  | 'interrupted'
  | 'paused'
export type UpdaterStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  isMaximized: boolean
}

export interface AppSettings {
  appearance: { theme: ThemeMode }
  window: { main: WindowState }
  behavior: { closeToTray: boolean; openAtLogin: boolean }
  shortcuts: { toggleWindow: string; clipboard: string; notes: string }
  updater: { autoCheck: boolean; autoDownload: boolean }
  protocol: { registered: boolean }
  ui: { lastRoute: string }
}

export const defaultSettings: AppSettings = {
  appearance: { theme: 'system' },
  window: { main: { width: 1200, height: 800, isMaximized: false } },
  behavior: { closeToTray: false, openAtLogin: false },
  shortcuts: {
    toggleWindow: 'CommandOrControl+Shift+L',
    clipboard: 'CommandOrControl+Shift+C',
    notes: 'CommandOrControl+Shift+N'
  },
  updater: { autoCheck: true, autoDownload: false },
  protocol: { registered: false },
  ui: { lastRoute: '/workbench/notes' }
}

export interface Note {
  id: number
  title: string
  body: string
  isEncrypted: boolean
  pinned: boolean
  createdAt: number
  updatedAt: number
}

export interface ClipboardItem {
  id: number
  kind: ClipboardKind
  text: string | null
  html: string | null
  imagePath: string | null
  createdAt: number
}

export interface DownloadRecord {
  id: number
  url: string
  filename: string
  savePath: string
  state: DownloadState
  received: number
  total: number
  createdAt: number
  finishedAt: number | null
}

export interface RecentFile {
  id: number
  path: string
  openedAt: number
}

export interface LabEvent {
  id: number
  module: string
  action: string
  ok: boolean
  message: string
  createdAt: number
}

export interface AppInfo {
  name: string
  version: string
  electron: string
  chrome: string
  node: string
  platform: NodeJS.Platform
  arch: string
  isPackaged: boolean
  userData: string
  dbReady: boolean
  updaterStatus: UpdaterStatus
  hasRepository: boolean
}
