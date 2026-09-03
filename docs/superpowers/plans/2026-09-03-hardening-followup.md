# 加固跟进 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补上进程崩溃恢复、再收一层 Session / 右键 / CSP / preload origin，以及 CI audit 与下载 Session 收口。

**Architecture:** 判定与文案是无 Electron 依赖的纯函数；挂载函数只接线。实验室事件抽出后供 gone 处理与 `lab:run` 共用。不新开 IPC 通道。

**Tech Stack:** 现有 Electron Lab（electron-vite、Vue 3、Vitest）。不新加 npm 包。不跑打包。

**Spec:** `docs/superpowers/specs/2026-09-03-hardening-followup-design.md`

---

## File map

```
src/shared/process-gone.ts
src/shared/lab-event-format.ts
src/shared/csp.ts
src/shared/permissions-policy.ts
src/shared/port-origin.ts
src/shared/security-checklist.ts
src/shared/security-status.ts
src/preload/index.ts
src/renderer/index.html
src/renderer/src/lab/catalog.ts
src/renderer/src/views/MetricsView.vue
src/main/index.ts
src/main/ipc/lab.ts
src/main/ipc/downloads.ts
src/main/ipc/browser.ts
src/main/services/lab-events.ts
src/main/services/process-recovery.ts
src/main/services/session-security.ts
src/main/windows/window-security.ts
.github/workflows/ci.yml
package.json
README.md
tests/process-gone.test.ts
tests/lab-events-format.test.ts
tests/csp.test.ts
tests/permissions-policy.test.ts
tests/port-origin.test.ts
tests/context-menu.test.ts
tests/security-checklist.test.ts
tests/lab-catalog.test.ts
```

工作目录：`/Users/julytian/Downloads/mianshi/electron-study/.worktrees/best-practices`（分支 `feat/best-practices`）。不要改父仓库 `master` 工作区。提交用 HEREDOC，不要 `--no-verify`。不要 push，除非用户明确要求。

新 BrowserWindow 必须 `sandbox: true`、`contextIsolation: true`、`nodeIntegration: false`。本期不新开窗口。不改 `invokeChannels` / `eventChannels`。

---

### Task 1: 主窗是否 reload

**Files:**

- Create: `src/shared/process-gone.ts`
- Test: `tests/process-gone.test.ts`

- [ ] **Step 1: 写失败测试**

Create `tests/process-gone.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { shouldReloadRenderer } from '../src/shared/process-gone'

describe('shouldReloadRenderer', () => {
  it('reloads the main window twice then stops', () => {
    expect(
      shouldReloadRenderer({ isMainWindow: true, reason: 'crashed', consecutiveReloads: 0 })
    ).toBe(true)
    expect(
      shouldReloadRenderer({ isMainWindow: true, reason: 'crashed', consecutiveReloads: 1 })
    ).toBe(true)
    expect(
      shouldReloadRenderer({ isMainWindow: true, reason: 'crashed', consecutiveReloads: 2 })
    ).toBe(false)
  })

  it('does not reload clean-exit or non-main windows', () => {
    expect(
      shouldReloadRenderer({ isMainWindow: true, reason: 'clean-exit', consecutiveReloads: 0 })
    ).toBe(false)
    expect(
      shouldReloadRenderer({ isMainWindow: false, reason: 'crashed', consecutiveReloads: 0 })
    ).toBe(false)
    expect(
      shouldReloadRenderer({ isMainWindow: false, reason: 'oom', consecutiveReloads: 0 })
    ).toBe(false)
  })

  it('reloads unknown crash reasons on the main window', () => {
    expect(
      shouldReloadRenderer({ isMainWindow: true, reason: 'oom', consecutiveReloads: 0 })
    ).toBe(true)
    expect(
      shouldReloadRenderer({
        isMainWindow: true,
        reason: 'integrity-failure',
        consecutiveReloads: 1
      })
    ).toBe(true)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run tests/process-gone.test.ts`

Expected: FAIL，找不到 `../src/shared/process-gone`

- [ ] **Step 3: 写最小实现**

Create `src/shared/process-gone.ts`:

```ts
export const DEFAULT_RENDERER_RELOAD_LIMIT = 2

export interface ReloadRendererInput {
  isMainWindow: boolean
  reason: string
  consecutiveReloads: number
  maxReloads?: number
}

export function shouldReloadRenderer(input: ReloadRendererInput): boolean {
  if (!input.isMainWindow) return false
  if (input.reason === 'clean-exit') return false
  const max = input.maxReloads ?? DEFAULT_RENDERER_RELOAD_LIMIT
  return input.consecutiveReloads < max
}

export function formatRenderProcessGoneMessage(input: {
  reason: string
  exitCode: number | string
  isMainWindow: boolean
  reload: boolean
  count: number
}): string {
  return `reason=${input.reason} exitCode=${input.exitCode} main=${input.isMainWindow} reload=${input.reload} count=${input.count}`
}

export function formatChildProcessGoneMessage(input: {
  type: string
  reason: string
  exitCode: number | string
}): string {
  return `type=${input.type} reason=${input.reason} exitCode=${input.exitCode}`
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run tests/process-gone.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/process-gone.test.ts src/shared/process-gone.ts
git commit -m "$(cat <<'EOF'
feat: 添加渲染进程崩溃是否 reload 的判定

主窗非 clean-exit 时最多连续恢复 2 次，子窗不自动 reload。

EOF
)"
```

---

### Task 2: 进程事件文本

**Files:**

- Create: `src/shared/lab-event-format.ts`
- Test: `tests/lab-events-format.test.ts`

- [ ] **Step 1: 写失败测试**

Create `tests/lab-events-format.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { formatRecentProcessEvents, type LabEventRowLike } from '../src/shared/lab-event-format'

function row(partial: Partial<LabEventRowLike> & Pick<LabEventRowLike, 'module' | 'action'>): LabEventRowLike {
  return {
    ok: false,
    message: 'gone',
    createdAt: 1,
    ...partial
  }
}

describe('formatRecentProcessEvents', () => {
  it('returns the empty copy when there are no process rows', () => {
    expect(formatRecentProcessEvents([])).toBe('暂无进程事件')
    expect(
      formatRecentProcessEvents([row({ module: 'metrics', action: 'refresh', createdAt: 9 })])
    ).toBe('暂无进程事件')
  })

  it('keeps only process rows, newest first, and caps at 10', () => {
    const rows: LabEventRowLike[] = [
      row({ module: 'process', action: 'old', createdAt: 1, message: 'a' }),
      row({ module: 'metrics', action: 'refresh', createdAt: 99, message: 'skip' }),
      row({ module: 'process', action: 'new', createdAt: 5, ok: true, message: 'b' })
    ]
    expect(formatRecentProcessEvents(rows)).toBe('new ok=true b; old ok=false a')

    const many = Array.from({ length: 12 }, (_, index) =>
      row({
        module: 'process',
        action: `e${index}`,
        createdAt: index,
        message: `m${index}`
      })
    )
    const text = formatRecentProcessEvents(many, 10)
    expect(text.startsWith('e11 ok=false m11')).toBe(true)
    expect(text.includes('e0 ')).toBe(false)
    expect(text.split('; ')).toHaveLength(10)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run tests/lab-events-format.test.ts`

Expected: FAIL，找不到模块

- [ ] **Step 3: 写最小实现**

Create `src/shared/lab-event-format.ts`:

```ts
export interface LabEventRowLike {
  module: string
  action: string
  ok: boolean
  message: string
  createdAt: number
}

export function formatRecentProcessEvents(rows: LabEventRowLike[], limit = 10): string {
  const processRows = rows
    .filter((row) => row.module === 'process')
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, limit)
  if (processRows.length === 0) return '暂无进程事件'
  return processRows
    .map((row) => `${row.action} ok=${row.ok} ${row.message}`)
    .join('; ')
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run tests/lab-events-format.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/lab-events-format.test.ts src/shared/lab-event-format.ts
git commit -m "$(cat <<'EOF'
feat: 添加进程事件摘要格式化

实验室只展示 module=process 的最近 10 条，没有则提示暂无。

EOF
)"
```

---

### Task 3: 抽出实验室事件并增加 recent-gone

**Files:**

- Create: `src/main/services/lab-events.ts`
- Modify: `src/main/ipc/lab.ts`
- Modify: `src/renderer/src/lab/catalog.ts`（`/lab/metrics` 的 `actions`）
- Modify: `tests/lab-catalog.test.ts`

- [ ] **Step 1: 写失败测试（目录）**

在 `tests/lab-catalog.test.ts` 末尾追加：

```ts
  it('lists refresh and recent-gone on the metrics module', () => {
    const metrics = labModules.find((module) => module.path === '/lab/metrics')
    expect(metrics?.actions.map((action) => action.id)).toEqual(['refresh', 'recent-gone'])
  })
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run tests/lab-catalog.test.ts`

Expected: FAIL，`/lab/metrics` 只有 `refresh`

- [ ] **Step 3: 抽出服务、接线、改目录**

Create `src/main/services/lab-events.ts`:

```ts
import type { LabEvent } from '../../shared/models'
import { formatRecentProcessEvents } from '../../shared/lab-event-format'
import { getDatabase } from './db'

export function recordLabEvent(
  module: string,
  action: string,
  ok: boolean,
  message: string
): void {
  try {
    getDatabase()
      .prepare(
        'INSERT INTO lab_events (module, action, ok, message, created_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(module, action, ok ? 1 : 0, message, Date.now())
  } catch {
    // 记录失败不影响实验室动作或进程恢复
  }
}

export function listLabEvents(limit = 50): LabEvent[] {
  const rows = getDatabase()
    .prepare('SELECT * FROM lab_events ORDER BY created_at DESC LIMIT ?')
    .all(limit) as Array<{
    id: number
    module: string
    action: string
    ok: number
    message: string
    created_at: number
  }>
  return rows.map((row) => ({
    id: row.id,
    module: row.module,
    action: row.action,
    ok: Boolean(row.ok),
    message: row.message,
    createdAt: row.created_at
  }))
}

export function recentProcessEventsMessage(limit = 10): string {
  return formatRecentProcessEvents(listLabEvents(50), limit)
}
```

`src/main/ipc/lab.ts` 做三处替换：

1. 删除函数 `recordLabEvent`（约 25–35 行）。增加：

```ts
import { listLabEvents, recordLabEvent, recentProcessEventsMessage } from '../services/lab-events'
```

2. 在 `executeLab` 的 `metrics` 分支改成：

```ts
  if (module === 'metrics') {
    if (action === 'refresh') {
      return ipcOk({ message: `进程数: ${app.getAppMetrics().length}` })
    }
    if (action === 'recent-gone') {
      return ipcOk({ message: recentProcessEventsMessage() })
    }
  }
```

删掉原来单独的 `if (module === 'metrics' && action === 'refresh')`。

3. `lab:events` handler 改为：

```ts
  ipcMain.handle('lab:events', () => {
    try {
      return ipcOk(listLabEvents())
    } catch (error) {
      return mapLabError(error)
    }
  })
```

`src/renderer/src/lab/catalog.ts` 的 `/lab/metrics` 模块 `actions` 改为：

```ts
    actions: [
      { id: 'refresh', title: '刷新进程摘要' },
      { id: 'recent-gone', title: '查看最近进程事件' }
    ]
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run tests/lab-catalog.test.ts tests/lab-events-format.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/services/lab-events.ts src/main/ipc/lab.ts src/renderer/src/lab/catalog.ts tests/lab-catalog.test.ts
git commit -m "$(cat <<'EOF'
feat: 抽出实验室事件并增加最近进程事件动作

gone 处理与 lab:run 共用同一张表，性能页可以查出最近崩溃记录。

EOF
)"
```

---

### Task 4: 挂载进程恢复与 enableSandbox

**Files:**

- Create: `src/main/services/process-recovery.ts`
- Modify: `src/main/index.ts`
- Modify: `src/renderer/src/views/MetricsView.vue`

- [ ] **Step 1: 实现 process-recovery**

Create `src/main/services/process-recovery.ts`:

```ts
import { app } from 'electron'
import log from 'electron-log/main'
import {
  formatChildProcessGoneMessage,
  formatRenderProcessGoneMessage,
  shouldReloadRenderer
} from '../../shared/process-gone'
import { getMainWindow } from '../windows/main'
import { recordLabEvent } from './lab-events'

let attached = false
let consecutiveReloads = 0
let loadHookedId: number | null = null

function hookMainLoadReset(): void {
  const win = getMainWindow()
  if (!win || win.isDestroyed()) return
  const id = win.webContents.id
  if (loadHookedId === id) return
  loadHookedId = id
  win.webContents.on('did-finish-load', () => {
    consecutiveReloads = 0
  })
}

export function attachProcessRecovery(): void {
  if (attached) return
  attached = true
  hookMainLoadReset()

  app.on('render-process-gone', (_event, webContents, details) => {
    const main = getMainWindow()
    const isMainWindow = Boolean(
      main && !main.isDestroyed() && webContents.id === main.webContents.id
    )
    if (isMainWindow) hookMainLoadReset()
    const reason = details.reason || 'unknown'
    const exitCode = details.exitCode ?? 'unknown'
    const reload =
      shouldReloadRenderer({
        isMainWindow,
        reason,
        consecutiveReloads
      }) && !webContents.isDestroyed()
    if (reload) {
      consecutiveReloads += 1
      try {
        webContents.reload()
      } catch (error) {
        log.error(error)
      }
    }
    recordLabEvent(
      'process',
      'render-process-gone',
      reload,
      formatRenderProcessGoneMessage({
        reason,
        exitCode,
        isMainWindow,
        reload,
        count: consecutiveReloads
      })
    )
  })

  app.on('child-process-gone', (_event, details) => {
    recordLabEvent(
      'process',
      'child-process-gone',
      false,
      formatChildProcessGoneMessage({
        type: details.type || 'unknown',
        reason: details.reason || 'unknown',
        exitCode: details.exitCode ?? 'unknown'
      })
    )
  })
}
```

- [ ] **Step 2: 在 index.ts 接线**

在 `src/main/index.ts` 的 import 区增加：

```ts
import { attachProcessRecovery } from './services/process-recovery'
```

在 `const gotLock = app.requestSingleInstanceLock()` **之前**增加一行：

```ts
app.enableSandbox()
```

在 `registerIpc()` 之后立刻增加：

```ts
  attachProcessRecovery()
```

- [ ] **Step 3: MetricsView 展示进程事件**

把 `src/renderer/src/views/MetricsView.vue` 整文件换成：

```vue
<script setup lang="ts">
import { onMounted, ref, shallowRef } from 'vue'
import type { TableColumnType } from 'ant-design-vue'
import { invokeIpc } from '../composables/useIpc'

interface MetricRow {
  pid: number
  type: string
  cpu: number
  memory: number
}

const rows = ref<MetricRow[]>([])
const crashInfo = shallowRef('')
const processEvents = shallowRef('')
const loading = shallowRef(false)

const columns: TableColumnType<MetricRow>[] = [
  { title: 'PID', dataIndex: 'pid', key: 'pid' },
  { title: '类型', dataIndex: 'type', key: 'type' },
  { title: 'CPU', key: 'cpu' },
  { title: '内存', key: 'memory' }
]

function formatCpu(value: number): string {
  return `${value.toFixed(1)}%`
}

function formatMemory(kb: number): string {
  return `${kb} KB`
}

async function refresh(): Promise<void> {
  loading.value = true
  try {
    rows.value = await invokeIpc('metrics:get')
    const dumps = await invokeIpc('lab:run', 'advanced', 'crash-dumps')
    crashInfo.value = dumps.message
    const gone = await invokeIpc('lab:run', 'metrics', 'recent-gone')
    processEvents.value = gone.message
  } catch {
    // invokeIpc 已 toast
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void refresh()
})
</script>

<template>
  <a-space direction="vertical" class="metrics-page" :size="16">
    <a-card title="进程与性能">
      <a-space direction="vertical" class="metrics-page" :size="12">
        <a-button type="primary" :loading="loading" @click="refresh">刷新</a-button>
        <a-table
          :columns="columns"
          :data-source="rows"
          :pagination="false"
          row-key="pid"
          size="small"
          :loading="loading"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'cpu'">{{ formatCpu(record.cpu) }}</template>
            <template v-else-if="column.key === 'memory'">{{
              formatMemory(record.memory)
            }}</template>
          </template>
        </a-table>
      </a-space>
    </a-card>
    <a-card title="崩溃转储">
      <a-typography-paragraph>
        {{ crashInfo || '尚未读取 crashDumps 目录。' }}
      </a-typography-paragraph>
    </a-card>
    <a-card title="进程事件">
      <a-typography-paragraph>
        {{ processEvents || '暂无进程事件' }}
      </a-typography-paragraph>
    </a-card>
  </a-space>
</template>

<style scoped>
.metrics-page {
  width: 100%;
}
</style>
```

不要用 `v-html`。

- [ ] **Step 4: 类型检查**

Run: `pnpm typecheck`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/services/process-recovery.ts src/main/index.ts src/renderer/src/views/MetricsView.vue
git commit -m "$(cat <<'EOF'
feat: 挂载渲染进程崩溃恢复并展示进程事件

主窗崩溃最多 reload 两次；子进程 gone 只记实验室事件。ready 前启用沙箱。

EOF
)"
```

---

### Task 5: CSP 三条新指令

**Files:**

- Modify: `src/shared/csp.ts`
- Modify: `src/renderer/index.html`
- Modify: `tests/csp.test.ts`

- [ ] **Step 1: 扩展失败测试**

把 `tests/csp.test.ts` 整文件换成：

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cspHeader, shouldAttachCsp } from '../src/shared/csp'

describe('cspHeader', () => {
  it('matches the renderer index.html meta content', () => {
    const html = readFileSync(resolve(__dirname, '../src/renderer/index.html'), 'utf8')
    const match = html.match(/http-equiv="Content-Security-Policy"[\s\S]*?content="([^"]+)"/)
    expect(match?.[1]).toBeTruthy()
    expect(cspHeader()).toBe(match?.[1])
  })

  it('keeps style unsafe-inline and adds object base-uri frame-ancestors', () => {
    const header = cspHeader()
    expect(header).toContain("style-src 'self' 'unsafe-inline'")
    expect(header).toContain("object-src 'none'")
    expect(header).toContain("base-uri 'self'")
    expect(header).toContain("frame-ancestors 'none'")
  })
})

describe('shouldAttachCsp', () => {
  it('attaches only for packaged app sessions', () => {
    expect(shouldAttachCsp('app', true)).toBe(true)
    expect(shouldAttachCsp('app', false)).toBe(false)
    expect(shouldAttachCsp('browser', true)).toBe(false)
    expect(shouldAttachCsp('browser', false)).toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run tests/csp.test.ts`

Expected: FAIL，缺少 `object-src`

- [ ] **Step 3: 改常量与 meta**

`src/shared/csp.ts` 的 `CSP_HEADER` 改为：

```ts
export const CSP_HEADER =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
```

`src/renderer/index.html` 的 meta `content` 必须与上面字符串**全等**：

```html
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run tests/csp.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/csp.ts src/renderer/index.html tests/csp.test.ts
git commit -m "$(cat <<'EOF'
feat: CSP 增加 object-src base-uri 与 frame-ancestors

收紧插件、基址和嵌套，同时保留 style-src 的 unsafe-inline。

EOF
)"
```

---

### Task 6: Permissions-Policy 与 Session 拒绝项

**Files:**

- Create: `src/shared/permissions-policy.ts`
- Modify: `src/main/services/session-security.ts`
- Test: `tests/permissions-policy.test.ts`

- [ ] **Step 1: 写失败测试**

Create `tests/permissions-policy.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  permissionsPolicyHeader,
  shouldAttachPermissionsPolicy
} from '../src/shared/permissions-policy'

describe('permissionsPolicyHeader', () => {
  it('disables geo camera usb serial hid bluetooth and display-capture', () => {
    const header = permissionsPolicyHeader()
    expect(header).toContain('geolocation=()')
    expect(header).toContain('camera=()')
    expect(header).toContain('usb=()')
    expect(header).toContain('serial=()')
    expect(header).toContain('hid=()')
    expect(header).toContain('bluetooth=()')
    expect(header).toContain('display-capture=()')
  })
})

describe('shouldAttachPermissionsPolicy', () => {
  it('matches CSP attach conditions', () => {
    expect(shouldAttachPermissionsPolicy('app', true)).toBe(true)
    expect(shouldAttachPermissionsPolicy('app', false)).toBe(false)
    expect(shouldAttachPermissionsPolicy('browser', true)).toBe(false)
    expect(shouldAttachPermissionsPolicy('browser', false)).toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run tests/permissions-policy.test.ts`

Expected: FAIL，找不到模块

- [ ] **Step 3: 实现头与挂载**

Create `src/shared/permissions-policy.ts`:

```ts
export const PERMISSIONS_POLICY_HEADER =
  'geolocation=(), camera=(), microphone=(), payment=(), usb=(), serial=(), hid=(), bluetooth=(), display-capture=()'

export function permissionsPolicyHeader(): string {
  return PERMISSIONS_POLICY_HEADER
}

export function shouldAttachPermissionsPolicy(
  kind: 'app' | 'browser',
  packaged: boolean
): boolean {
  return kind === 'app' && packaged
}
```

把 `src/main/services/session-security.ts` 整文件换成：

```ts
import { app, shell, type Session } from 'electron'
import { isAllowedExternalUrl } from '../../shared/external-url'
import { cspHeader, shouldAttachCsp } from '../../shared/csp'
import {
  permissionsPolicyHeader,
  shouldAttachPermissionsPolicy
} from '../../shared/permissions-policy'
import { isSessionPermissionAllowed, type SessionSecurityKind } from './session-permissions'
import { isRendererNavigationAllowed } from '../windows/window-policy'

const sessionKinds = new WeakMap<Session, SessionSecurityKind>()
let webContentsHooked = false
let appIsDev = false

function ensureWebContentsHook(): void {
  if (webContentsHooked) return
  webContentsHooked = true
  app.on('web-contents-created', (_event, contents) => {
    const kind = sessionKinds.get(contents.session)
    if (!kind) return
    contents.on('will-attach-webview', (event) => {
      event.preventDefault()
    })
    if (kind !== 'app') return
    contents.on('will-redirect', (event, url) => {
      const current = contents.getURL()
      if (isRendererNavigationAllowed(current, url, appIsDev)) return
      event.preventDefault()
      if (isAllowedExternalUrl(url)) void shell.openExternal(url)
    })
  })
}

function attachDeniedDeviceHandlers(ses: Session): void {
  try {
    ses.setDisplayMediaRequestHandler((_request, callback) => {
      callback({})
    })
  } catch (error) {
    console.error(error)
  }
  try {
    ses.setDevicePermissionHandler(() => false)
  } catch (error) {
    console.error(error)
  }
}

export function attachSessionSecurity(
  ses: Session,
  kind: SessionSecurityKind,
  options: { packaged: boolean; isDev: boolean }
): void {
  sessionKinds.set(ses, kind)
  if (kind === 'app') appIsDev = options.isDev

  ses.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(isSessionPermissionAllowed(kind, permission))
  })
  ses.setPermissionCheckHandler((_webContents, permission) => {
    return isSessionPermissionAllowed(kind, permission)
  })
  attachDeniedDeviceHandlers(ses)

  const attachHeaders =
    shouldAttachCsp(kind, options.packaged) ||
    shouldAttachPermissionsPolicy(kind, options.packaged)
  if (attachHeaders) {
    ses.webRequest.onHeadersReceived((details, callback) => {
      if (details.resourceType !== 'mainFrame' && details.resourceType !== 'subFrame') {
        callback({})
        return
      }
      const headers = { ...(details.responseHeaders ?? {}) }
      if (shouldAttachCsp(kind, options.packaged)) {
        headers['Content-Security-Policy'] = [cspHeader()]
      }
      if (shouldAttachPermissionsPolicy(kind, options.packaged)) {
        headers['Permissions-Policy'] = [permissionsPolicyHeader()]
      }
      callback({ responseHeaders: headers })
    })
  }

  ensureWebContentsHook()
}
```

`isSessionPermissionAllowed` 白名单不要改。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run tests/permissions-policy.test.ts tests/csp.test.ts tests/session-permissions.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/permissions-policy.ts src/main/services/session-security.ts tests/permissions-policy.test.ts
git commit -m "$(cat <<'EOF'
feat: 拒绝页面级屏幕捕获与外设并加上 Permissions-Policy

getDisplayMedia 与 HID/串口/USB/蓝牙一律拒绝，截屏继续走 capture IPC。

EOF
)"
```

---

### Task 7: 正式包右键去掉检查

**Files:**

- Modify: `src/main/windows/window-security.ts`
- Modify: `src/main/ipc/browser.ts`
- Test: `tests/context-menu.test.ts`

- [ ] **Step 1: 写失败测试**

Create `tests/context-menu.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isDevtoolsMenuRole } from '../src/main/windows/app-menu'
import { buildPackagedContextMenuTemplate } from '../src/main/windows/window-security'

function flatten(
  items: Array<{ role?: string; label?: string; submenu?: Array<{ role?: string; label?: string }> }>
): Array<{ role?: string; label?: string }> {
  return items.flatMap((item) => [item, ...(item.submenu ?? [])])
}

describe('buildPackagedContextMenuTemplate', () => {
  it('has edit roles and no inspect or toggleDevTools', () => {
    const flat = flatten(buildPackagedContextMenuTemplate())
    expect(flat.map((item) => item.role)).toEqual([
      'undo',
      'redo',
      'cut',
      'copy',
      'paste',
      'selectAll'
    ])
    for (const item of flat) {
      expect(isDevtoolsMenuRole(item.role)).toBe(false)
      expect(item.label?.includes('检查') ?? false).toBe(false)
      expect(item.label?.includes('Toggle Developer Tools') ?? false).toBe(false)
    }
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run tests/context-menu.test.ts`

Expected: FAIL，没有 `buildPackagedContextMenuTemplate`

- [ ] **Step 3: 实现模板与挂载**

把 `src/main/windows/window-security.ts` 整文件换成：

```ts
import { Menu, type BrowserWindow, type WebContents } from 'electron'
import { type MenuItemLike } from './app-menu'

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

export function buildPackagedContextMenuTemplate(): MenuItemLike[] {
  return [
    { role: 'undo' },
    { role: 'redo' },
    { role: 'cut' },
    { role: 'copy' },
    { role: 'paste' },
    { role: 'selectAll' }
  ]
}

export function attachPackagedContextMenu(webContents: WebContents): void {
  webContents.on('context-menu', (event) => {
    event.preventDefault()
    Menu.buildFromTemplate(
      buildPackagedContextMenuTemplate() as Electron.MenuItemConstructorOptions[]
    ).popup()
  })
}

export function attachWindowSecurity(win: BrowserWindow, packaged: boolean): void {
  if (!packaged) return
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && isDevtoolsShortcut(input)) {
      event.preventDefault()
    }
  })
  attachPackagedContextMenu(win.webContents)
}
```

`src/main/ipc/browser.ts`：

1. 增加 import（文件第一行已有 `import { app, ipcMain, WebContentsView } from 'electron'`，不要拆掉 `app`）：

```ts
import { attachPackagedContextMenu } from '../windows/window-security'
```

2. 在 `createView()` 里 `const wc = view.webContents` 之后增加：

```ts
  if (app.isPackaged) {
    attachPackagedContextMenu(wc)
  }
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run tests/context-menu.test.ts tests/devtools-shortcut.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/windows/window-security.ts src/main/ipc/browser.ts tests/context-menu.test.ts
git commit -m "$(cat <<'EOF'
feat: 正式包右键菜单去掉检查项

主窗、子窗和迷你浏览器 View 共用同一套仅编辑角色的菜单。

EOF
)"
```

---

### Task 8: preload MessagePort origin

**Files:**

- Create: `src/shared/port-origin.ts`
- Modify: `src/preload/index.ts`
- Test: `tests/port-origin.test.ts`

- [ ] **Step 1: 写失败测试**

Create `tests/port-origin.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isTrustedPortMessageOrigin, portMessageTargetOrigin } from '../src/shared/port-origin'

describe('portMessageTargetOrigin', () => {
  it('returns the page origin and never star', () => {
    expect(portMessageTargetOrigin('http://localhost:5173')).toBe('http://localhost:5173')
    expect(portMessageTargetOrigin('file://')).toBe('file://')
    expect(portMessageTargetOrigin('*')).toBe('null')
    expect(portMessageTargetOrigin('')).toBe('null')
    expect(portMessageTargetOrigin('   ')).toBe('null')
  })
})

describe('isTrustedPortMessageOrigin', () => {
  it('rejects star and mismatched origins', () => {
    expect(isTrustedPortMessageOrigin('*', 'http://localhost:5173')).toBe(false)
    expect(isTrustedPortMessageOrigin('http://localhost:5173', '*')).toBe(false)
    expect(isTrustedPortMessageOrigin('https://evil.test', 'http://localhost:5173')).toBe(false)
    expect(isTrustedPortMessageOrigin('http://localhost:5173', 'http://localhost:5173')).toBe(true)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run tests/port-origin.test.ts`

Expected: FAIL，找不到模块

- [ ] **Step 3: 实现并改 preload**

Create `src/shared/port-origin.ts`:

```ts
export function portMessageTargetOrigin(locationOrigin: string): string {
  const trimmed = locationOrigin.trim()
  if (!trimmed || trimmed === '*') return 'null'
  return trimmed
}

export function isTrustedPortMessageOrigin(
  eventOrigin: string,
  locationOrigin: string
): boolean {
  if (eventOrigin === '*' || locationOrigin === '*') return false
  return eventOrigin === portMessageTargetOrigin(locationOrigin)
}
```

把 `src/preload/index.ts` 整文件换成：

```ts
import { contextBridge, ipcRenderer } from 'electron'
import { eventChannels, invokeChannels, type EventChannel, type InvokeChannel } from '../shared/ipc'
import { isTrustedPortMessageOrigin, portMessageTargetOrigin } from '../shared/port-origin'

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

window.addEventListener('message', (event) => {
  if (!isTrustedPortMessageOrigin(event.origin, window.location.origin)) return
  if (event.data !== 'port') return
  const port = event.ports[0]
  port.onmessage = (msg) => {
    window.dispatchEvent(new CustomEvent('lab-port', { detail: msg.data }))
  }
  ;(window as unknown as { __labPort?: MessagePort }).__labPort = port
})

// webContents.postMessage 走 ipcRenderer；再转到主世界，渲染进程才能用 __labPort
ipcRenderer.on('port', (event) => {
  if (event.ports.length === 0) return
  window.postMessage('port', portMessageTargetOrigin(window.location.origin), event.ports)
})
```

preload 里禁止出现 `'*'` 作为 `postMessage` 的 targetOrigin。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run tests/port-origin.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/port-origin.ts src/preload/index.ts tests/port-origin.test.ts
git commit -m "$(cat <<'EOF'
fix: preload 转发 MessagePort 时收紧 origin

不再向任意 origin postMessage，只接受与当前页面相同的来源。

EOF
)"
```

---

### Task 9: 对照表与安全状态

**Files:**

- Modify: `src/shared/security-checklist.ts`
- Modify: `src/shared/security-status.ts`
- Modify: `tests/security-checklist.test.ts`

- [ ] **Step 1: 更新失败测试**

把 `tests/security-checklist.test.ts` 整文件换成：

```ts
import { describe, expect, it } from 'vitest'
import { SECURITY_CHECKLIST } from '../src/shared/security-checklist'
import { formatSecurityStatus } from '../src/shared/security-status'

describe('SECURITY_CHECKLIST', () => {
  it('has eleven rows with id title file and detail', () => {
    expect(SECURITY_CHECKLIST).toHaveLength(11)
    expect(SECURITY_CHECKLIST.map((row) => row.id)).toEqual([
      'sandbox',
      'context-isolation',
      'no-node',
      'permission-check',
      'navigation',
      'no-webview',
      'csp',
      'fuses',
      'process-recovery',
      'display-media',
      'device-permission'
    ])
    for (const row of SECURITY_CHECKLIST) {
      expect(row.title.length).toBeGreaterThan(0)
      expect(row.file.length).toBeGreaterThan(0)
      expect(row.detail.length).toBeGreaterThan(0)
    }
  })
})

describe('formatSecurityStatus', () => {
  it('joins packaged csp permissionCheck fuses and deny flags', () => {
    const dev = formatSecurityStatus(false)
    expect(dev).toContain('packaged=false')
    expect(dev).toContain('cspSession=false')
    expect(dev).toContain('permissionCheck=true')
    expect(dev).toContain('fuses.runAsNode=false')
    expect(dev).toContain('fuses.enableCookieEncryption=true')
    expect(dev).toContain('enableSandbox=true')
    expect(dev).toContain('displayMedia=deny')
    expect(dev).toContain('devicePermission=deny')

    const packaged = formatSecurityStatus(true)
    expect(packaged).toContain('packaged=true')
    expect(packaged).toContain('cspSession=true')
    expect(packaged).toContain('enableSandbox=true')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run tests/security-checklist.test.ts`

Expected: FAIL，长度仍是 8，缺少新字段

- [ ] **Step 3: 改数据**

`src/shared/security-checklist.ts` 的 `csp.detail` 改为：

```ts
    detail: '开发态靠 meta；正式包再给 defaultSession 加同一条 CSP 与 Permissions-Policy。含 object-src / base-uri / frame-ancestors。'
```

在数组末尾追加：

```ts
  {
    id: 'process-recovery',
    title: '渲染进程崩溃恢复',
    file: 'src/main/services/process-recovery.ts',
    detail: '主窗 render-process-gone 最多 reload 两次；子窗与 GPU 只记实验室事件。'
  },
  {
    id: 'display-media',
    title: '拒绝页面级屏幕捕获',
    file: 'src/main/services/session-security.ts',
    detail: 'setDisplayMediaRequestHandler 空回调拒绝。截屏只走 capture IPC。'
  },
  {
    id: 'device-permission',
    title: '拒绝 HID / 串口 / USB / 蓝牙',
    file: 'src/main/services/session-security.ts',
    detail: 'setDevicePermissionHandler 一律 false。'
  }
```

`src/shared/security-status.ts` 整文件换成：

```ts
import { ELECTRON_FUSES } from './electron-fuses'

export function formatSecurityStatus(packaged: boolean): string {
  const parts = [
    `packaged=${packaged}`,
    `cspSession=${packaged}`,
    'permissionCheck=true',
    ...Object.entries(ELECTRON_FUSES).map(([key, value]) => `fuses.${key}=${value}`),
    'enableSandbox=true',
    'displayMedia=deny',
    'devicePermission=deny'
  ]
  return parts.join('; ')
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run tests/security-checklist.test.ts tests/lab-catalog.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/security-checklist.ts src/shared/security-status.ts tests/security-checklist.test.ts
git commit -m "$(cat <<'EOF'
feat: 对照表增加到 11 行并展示拒绝策略

安全状态补上 enableSandbox、displayMedia 与 devicePermission。

EOF
)"
```

---

### Task 10: 下载改走浏览器 Session

**Files:**

- Modify: `src/main/ipc/downloads.ts`

- [ ] **Step 1: 改 downloadURL 与 will-download**

`src/main/ipc/downloads.ts`：

1. 把

```ts
import { desktopCapturer, ipcMain, session } from 'electron'
```

改成：

```ts
import { desktopCapturer, ipcMain } from 'electron'
```

2. `getDownloads()` 里的 `downloadURL` 改为：

```ts
      downloadURL: (url) => getBrowserSession().downloadURL(url),
```

3. `listenWillDownload()` 整段换成：

```ts
function listenWillDownload(): void {
  if (listening) return
  listening = true
  getBrowserSession().on('will-download', (_event, item) => {
    getDownloads().handleWillDownload(item)
  })
}
```

不要再监听 `session.defaultSession`。

- [ ] **Step 2: 跑现有下载测试**

Run: `pnpm exec vitest run tests/downloads.test.ts`

Expected: PASS（纯函数未改，`src/main/ipc/downloads.ts` 的接线不在这个测试里）

- [ ] **Step 3: Commit**

```bash
git add src/main/ipc/downloads.ts
git commit -m "$(cat <<'EOF'
fix: 下载任务改走 persist:browser

start 与 will-download 都只打浏览器分区，不再经过 defaultSession。

EOF
)"
```

---

### Task 11: CI audit

**Files:**

- Modify: `.github/workflows/ci.yml`
- Modify: `package.json`（仅当必须 ignore CVE）
- Modify: `README.md`（安全一节补一句 audit；若有 ignore 再写原因）

- [ ] **Step 1: 先本地跑 audit**

Run: `pnpm audit --audit-level=high`

按结果二选一（不要空 ignore）：

- 退出码 0：不改 `package.json` 的 `pnpm.auditConfig`。
- 退出码非 0：能升级就升级并更新 lockfile（`pnpm update <pkg>`，不要手改 lockfile）。消不掉的 CVE 写入 `package.json`：

```json
  "pnpm": {
    "onlyBuiltDependencies": [
      "electron",
      "esbuild",
      "better-sqlite3"
    ],
    "auditConfig": {
      "ignoreCves": [
        "CVE-YYYY-NNNNN"
      ]
    }
  }
```

`ignoreCves` 必须是这次 `pnpm audit` 输出里的真实编号。同时在 `README.md` 的「安全」节追加一句，例如：`CI 跑 pnpm audit --audit-level=high。忽略 CVE-YYYY-NNNNN，因为……（仅开发依赖 / 无修复版本）。`

若没有忽略项，「安全」节只追加：`CI 在 test 之前跑 pnpm audit --audit-level=high。`

- [ ] **Step 2: 改 workflow**

把 `.github/workflows/ci.yml` 整文件换成：

```yml
name: CI

on:
  push:
    branches:
      - master
  pull_request:
    branches:
      - master

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm audit --audit-level=high
      - run: pnpm test
      - run: pnpm typecheck
      - run: pnpm lint
```

- [ ] **Step 3: 再跑一次 audit 确认本地能过**

Run: `pnpm audit --audit-level=high`

Expected: 退出码 0（含已声明的 ignore）

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml README.md package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
ci: 在测试前增加 high 级别依赖审计

high 与 critical 会挡 CI；无修复版本的 CVE 才写入忽略名单。

EOF
)"
```

若 `package.json` / lockfile / README 没有实际改动，就不要 `git add` 它们。

---

### Task 12: 全量验证

**Files:** 无新文件

- [ ] **Step 1: 跑完整检查**

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm audit --audit-level=high
```

Expected:

- `pnpm test`：全部通过（相对本期开始应多出 process-gone / lab-events-format / permissions-policy / port-origin / context-menu 等文件）
- `pnpm typecheck`：无错误
- `pnpm lint`：无错误
- `pnpm audit --audit-level=high`：退出码 0

若有失败，先修再重新跑同一组命令，不要宣称完成。

- [ ] **Step 2: 对照规格扫一遍**

确认这些都已落地：

- `app.enableSandbox()` 在 `whenReady` 之前
- `attachProcessRecovery()` 在 `registerIpc()` 之后
- 正式包右键模板无 `toggleDevTools`
- `setDisplayMediaRequestHandler` + `setDevicePermissionHandler`
- CSP 三条新指令 + Permissions-Policy
- preload 无 `postMessage(..., '*')`
- downloads 只听 `getBrowserSession()`
- CI 含 `pnpm audit --audit-level=high`
- 对照表 11 行；`formatSecurityStatus` 含三字段
- 未改 `invokeChannels`

- [ ] **Step 3: 若 Step 1 修过文件则再提交**

只在有改动时：

```bash
git add -u
git commit -m "$(cat <<'EOF'
fix: 收口加固跟进的类型与检查

全量 test / typecheck / lint / audit 通过后再收尾。

EOF
)"
```

不要 push。PR 已存在：<https://github.com/julytian/electron-study/pull/1>，等用户说再推。
