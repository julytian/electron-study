import { app, nativeImage } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { getDatabase } from '../services/db'
import { getMainWindow, showMainWindow } from '../windows/main'
import { platformError } from './error'
import { existingRecentPaths } from './recent-paths'

function resolveAppIcon(): Electron.NativeImage {
  const image = nativeImage.createFromPath(join(__dirname, '../../resources/icon.png'))
  return image.isEmpty() ? nativeImage.createEmpty() : image
}

function queryRecentFileRows(): Array<{ path: string }> {
  return getDatabase()
    .prepare('SELECT path FROM recent_files ORDER BY opened_at DESC')
    .all() as Array<{ path: string }>
}

export function refreshWindowsJumpList(): { message: string } {
  if (process.platform !== 'win32') {
    throw platformError('E_PLATFORM: Jump List 仅支持 Windows')
  }

  const paths = existingRecentPaths(queryRecentFileRows(), existsSync, 15)
  app.setJumpList([
    { type: 'recent' },
    {
      type: 'custom',
      name: '最近文件',
      items: paths.map((filePath) => ({ type: 'file' as const, path: filePath }))
    }
  ])

  try {
    app.setUserTasks([
      {
        program: process.execPath,
        arguments: '',
        title: '打开 Electron Lab',
        description: '打开主窗口',
        iconPath: process.execPath,
        iconIndex: 0
      }
    ])
  } catch {
    throw platformError('E_PLATFORM: setUserTasks 失败')
  }

  const win = getMainWindow()
  if (win && typeof win.setThumbarButtons === 'function') {
    const icon = resolveAppIcon()
    try {
      win.setThumbarButtons([
        {
          tooltip: '笔记',
          icon,
          click: () => {
            showMainWindow('/workbench/notes')
          }
        },
        {
          tooltip: '剪贴板',
          icon,
          click: () => {
            showMainWindow('/workbench/clipboard')
          }
        }
      ])
    } catch {
      // 当前环境可能不支持任务栏缩略图按钮
    }
  }

  return { message: '已刷新 Jump List、User Tasks 与缩略图按钮' }
}
