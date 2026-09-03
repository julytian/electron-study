import type { BrowserWindow } from 'electron'

export interface DevtoolsShortcutInput {
  key: string
  control: boolean
  alt: boolean
  shift: boolean
  meta: boolean
}

export function isDevtoolsShortcut(input: DevtoolsShortcutInput): boolean {
  if (input.key === 'F12') return true
  const letter = input.key.length === 1 ? input.key.toUpperCase() : input.key
  const cmdOrCtrl = input.meta || input.control
  if (letter === 'I' && cmdOrCtrl && (input.alt || input.shift)) return true
  if (letter === 'J' && input.meta && input.alt) return true
  if (letter === 'J' && input.control && input.shift) return true
  return false
}

export function attachWindowSecurity(win: BrowserWindow, packaged: boolean): void {
  if (!packaged) return
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && isDevtoolsShortcut(input)) {
      event.preventDefault()
    }
  })
}
