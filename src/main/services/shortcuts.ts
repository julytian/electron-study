import { app, globalShortcut } from 'electron'
import log from 'electron-log/main'
import { getSettings } from './conf'
import { collectFailedAccelerators } from './shortcut-bind'
import { showMainWindow, toggleMainWindow } from '../windows/main'

let willQuitBound = false

export function registerShortcuts(): string[] {
  const { shortcuts } = getSettings()
  const actions: Record<string, () => void> = {
    [shortcuts.toggleWindow]: () => toggleMainWindow(),
    [shortcuts.clipboard]: () => {
      showMainWindow('/workbench/clipboard')
    },
    [shortcuts.notes]: () => {
      showMainWindow('/workbench/notes')
    }
  }

  const failed = collectFailedAccelerators(shortcuts, (accelerator) =>
    globalShortcut.register(accelerator, () => {
      actions[accelerator]?.()
    })
  )

  for (const accelerator of failed) {
    log.warn(`快捷键冲突: ${accelerator}`)
  }

  if (!willQuitBound) {
    willQuitBound = true
    app.on('will-quit', () => {
      globalShortcut.unregisterAll()
    })
  }

  return failed
}
