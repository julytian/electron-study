import { app, desktopCapturer, ipcMain, Notification, safeStorage, utilityProcess } from 'electron'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import { errorCodes, ipcError, ipcOk, type IpcResult } from '../../shared/ipc-result'
import type { UpdaterStatus } from '../../shared/models'
import { formatSecurityStatus } from '../../shared/security-status'
import { applyTouchBar, refreshDockMenu } from '../platforms/mac'
import { refreshWindowsJumpList } from '../platforms/win'
import { getDatabase } from '../services/db'
import { ensureAppDirs } from '../services/paths'
import { getSettings } from '../services/conf'
import { getUpdaterMachine } from '../services/updater'
import { createChildWindow } from '../windows/child'
import { canRunCrashDemo } from '../utility/crash-guard'

const MOCK_ACTIONS: Record<string, UpdaterStatus> = {
  'mock-checking': 'checking',
  'mock-available': 'available',
  'mock-downloading': 'downloading',
  'mock-downloaded': 'downloaded',
  'mock-error': 'error'
}

function recordLabEvent(module: string, action: string, ok: boolean, message: string): void {
  try {
    getDatabase()
      .prepare(
        'INSERT INTO lab_events (module, action, ok, message, created_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(module, action, ok ? 1 : 0, message, Date.now())
  } catch {
    // 记录失败不影响实验室动作本身
  }
}

function mapLabError(error: unknown): ReturnType<typeof ipcError> {
  const name = error instanceof Error ? error.name : ''
  const message = error instanceof Error ? error.message : String(error)
  if (name.includes('E_PLATFORM') || message.includes('E_PLATFORM')) {
    return ipcError(errorCodes.PLATFORM, message)
  }
  return ipcError(errorCodes.VALIDATION, message)
}

function inspectCrashDumps(): { message: string } {
  const dir = app.getPath('crashDumps')
  const exists = existsSync(dir)
  let files = 0
  if (exists) {
    try {
      files = readdirSync(dir, { recursive: true }).length
    } catch {
      files = 0
    }
  }
  return { message: `${dir} 存在=${exists} 文件数=${files}` }
}

function runUtilityExport(): Promise<{ message: string }> {
  return new Promise((resolve, reject) => {
    const workerPath = join(__dirname, 'export-worker.js')
    const payload = JSON.stringify({ text: 'electron-lab', times: 3 })
    const child = utilityProcess.fork(workerPath, [payload], {
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let stdout = ''
    let stderr = ''
    let settled = false

    const finish = (error?: Error, message?: string): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (error) reject(error)
      else resolve({ message: message ?? '导出完成' })
    }

    const timer = setTimeout(() => {
      child.kill()
      finish(new Error('utilityProcess 超时'))
    }, 10_000)

    let attached = false
    const attach = (): void => {
      if (attached) return
      if (!child.stdout && !child.stderr) return
      attached = true
      child.stdout?.on('data', (chunk: string | Buffer) => {
        stdout += String(chunk)
      })
      child.stderr?.on('data', (chunk: string | Buffer) => {
        stderr += String(chunk)
      })
    }
    attach()
    child.on('spawn', attach)

    child.on('exit', (code) => {
      if (code !== 0) {
        finish(new Error(stderr.trim() || 'export-worker 失败'))
        return
      }
      const raw = stdout.trim()
      try {
        const parsed = JSON.parse(raw) as { text?: string }
        finish(undefined, parsed.text ?? raw)
      } catch {
        finish(undefined, raw || '导出完成')
      }
    })
  })
}

async function executeLab(module: string, action: string): Promise<IpcResult<{ message: string }>> {
  if (module === 'platform') {
    if (action === 'refresh-jump-list') return ipcOk(refreshWindowsJumpList())
    if (action === 'refresh-dock') return ipcOk(refreshDockMenu())
    if (action === 'set-touchbar') return ipcOk(applyTouchBar())
  }

  if (module === 'security') {
    if (action === 'app-info') {
      return ipcOk({
        message: `name=${app.getName()} version=${app.getVersion()} packaged=${app.isPackaged} sandbox=渲染进程无 Node`
      })
    }
    if (action === 'security-status') {
      return ipcOk({ message: formatSecurityStatus(app.isPackaged) })
    }
  }

  if (module === 'window' && action === 'create-child') {
    createChildWindow()
    return ipcOk({ message: '已创建子窗口' })
  }

  if (module === 'desktop' && action === 'notify') {
    if (!Notification.isSupported()) {
      return ipcError(errorCodes.PLATFORM, '当前系统不支持通知')
    }
    new Notification({ title: '实验室', body: '系统与桌面演示通知' }).show()
    return ipcOk({ message: '已发送系统通知' })
  }

  if (module === 'files' && action === 'db-status') {
    const { dbFile } = ensureAppDirs()
    try {
      getDatabase()
      return ipcOk({ message: `数据库就绪: ${dbFile}` })
    } catch {
      return ipcOk({ message: `数据库未就绪: ${dbFile}` })
    }
  }

  if (module === 'media' && action === 'sources-count') {
    const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] })
    return ipcOk({ message: `捕获源数量: ${sources.length}` })
  }

  if (module === 'native-ui' && action === 'platform') {
    return ipcOk({ message: process.platform })
  }

  if (module === 'protocol' && action === 'status') {
    return ipcOk({ message: `协议已注册: ${getSettings().protocol.registered}` })
  }

  if (module === 'network' && action === 'isolation') {
    return ipcOk({
      message: '拦截与代理仅作用于 persist:browser，不影响主界面 defaultSession'
    })
  }

  if (module === 'safe-storage' && action === 'probe') {
    return ipcOk({ message: `safeStorage 加密可用: ${safeStorage.isEncryptionAvailable()}` })
  }

  if (module === 'metrics' && action === 'refresh') {
    return ipcOk({ message: `进程数: ${app.getAppMetrics().length}` })
  }

  if (module === 'advanced') {
    if (action === 'utility-export') {
      return ipcOk(await runUtilityExport())
    }
    if (action === 'crash-dumps') {
      return ipcOk(inspectCrashDumps())
    }
    if (action === 'crash-main') {
      if (!canRunCrashDemo(app.isPackaged) || !is.dev) {
        return ipcError(errorCodes.PLATFORM, '正式包不提供 crash-main 演示')
      }
      setImmediate(() => {
        throw new Error('lab crash-main demo')
      })
      return ipcOk({ message: '已触发主进程演示异常' })
    }
    const mockStatus = MOCK_ACTIONS[action]
    if (mockStatus) {
      getUpdaterMachine().mock(mockStatus)
      return ipcOk({ message: `已 mock 为 ${mockStatus}` })
    }
  }

  return ipcError(errorCodes.VALIDATION, `未知实验室动作: ${module}/${action}`)
}

export function registerLabIpc(): void {
  ipcMain.handle('lab:run', async (_event, module: string, action: string) => {
    try {
      const result = await executeLab(module, action)
      recordLabEvent(
        module,
        action,
        result.ok,
        result.ok ? result.data.message : result.error.message
      )
      return result
    } catch (error) {
      const mapped = mapLabError(error)
      recordLabEvent(module, action, false, mapped.error.message)
      return mapped
    }
  })

  ipcMain.handle('metrics:get', () => {
    try {
      return ipcOk(
        app.getAppMetrics().map((metric) => ({
          pid: metric.pid,
          type: metric.type,
          cpu: metric.cpu.percentCPUUsage,
          memory: metric.memory.workingSetSize
        }))
      )
    } catch (error) {
      return mapLabError(error)
    }
  })

  ipcMain.handle('lab:events', () => {
    try {
      const rows = getDatabase()
        .prepare('SELECT * FROM lab_events ORDER BY created_at DESC LIMIT 50')
        .all() as Array<{
        id: number
        module: string
        action: string
        ok: number
        message: string
        created_at: number
      }>
      return ipcOk(
        rows.map((row) => ({
          id: row.id,
          module: row.module,
          action: row.action,
          ok: Boolean(row.ok),
          message: row.message,
          createdAt: row.created_at
        }))
      )
    } catch (error) {
      return mapLabError(error)
    }
  })
}
