import { app, Menu, TouchBar } from 'electron'
import { getMainWindow, showMainWindow } from '../windows/main'
import { platformError } from './error'

export function refreshDockMenu(): { message: string } {
  if (!app.dock) {
    throw platformError('E_PLATFORM: Dock 仅支持 macOS')
  }

  app.dock.setMenu(
    Menu.buildFromTemplate([
      {
        label: '笔记',
        click: () => {
          showMainWindow('/workbench/notes')
        }
      },
      {
        label: '剪贴板',
        click: () => {
          showMainWindow('/workbench/clipboard')
        }
      }
    ])
  )

  return { message: '已刷新 Dock 菜单' }
}

export function applyTouchBar(): { message: string } {
  if (process.platform !== 'darwin') {
    throw platformError('E_PLATFORM: TouchBar 仅支持 macOS')
  }
  if (typeof TouchBar === 'undefined') {
    throw platformError('E_PLATFORM: 当前设备无 TouchBar')
  }

  try {
    const tb = new TouchBar({
      items: [
        new TouchBar.TouchBarButton({
          label: '笔记',
          click: () => {
            showMainWindow('/workbench/notes')
          }
        })
      ]
    })
    getMainWindow()?.setTouchBar(tb)
    return { message: '已设置 TouchBar' }
  } catch {
    throw platformError('E_PLATFORM: 当前设备无 TouchBar')
  }
}
