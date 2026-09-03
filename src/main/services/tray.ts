import { app, Menu, Tray, nativeImage } from 'electron'
import { join } from 'node:path'
import { checkUpdates } from './updater'
import { getMainWindow, showMainWindow } from '../windows/main'

let tray: Tray | null = null

function resolveTrayIcon(): Electron.NativeImage {
  const image = nativeImage.createFromPath(join(__dirname, '../../resources/icon.png'))
  return image.isEmpty() ? nativeImage.createEmpty() : image
}

export function createTray(): Tray {
  if (tray) return tray

  tray = new Tray(resolveTrayIcon())
  tray.setToolTip('Electron Lab')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: '打开',
        click: () => {
          showMainWindow()
        }
      },
      {
        label: '剪贴板',
        click: () => {
          showMainWindow('/workbench/clipboard')
        }
      },
      {
        label: '检查更新',
        click: () => {
          checkUpdates()
        }
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          app.quit()
        }
      }
    ])
  )
  tray.on('click', () => {
    getMainWindow()?.show()
  })

  return tray
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}
