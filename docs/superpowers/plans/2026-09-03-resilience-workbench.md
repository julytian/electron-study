# 加固收口与工作台边角 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 收口加固终审四条 Minor，并补上系统在线状态与迷你浏览器页内查找。

**Architecture:** 判定与文案是无 Electron 依赖的纯函数；挂载与 IPC 只接线。在线状态并进现有电源通道。查找只新增 `browser:find`，不新开 event。

**Tech Stack:** 现有 Electron Lab（electron-vite、Vue 3、ant-design-vue、Vitest）。不新加 npm 包。不跑打包。

**Spec:** `docs/superpowers/specs/2026-09-03-resilience-workbench-design.md`

---

## File map

```
src/shared/port-origin.ts              # shouldAcceptLabPortMessage
src/shared/lab-event-format.ts         # LIST_PROCESS_EVENTS_SQL
src/shared/power-status.ts             # powerSnapshot / readOnlineFlag
src/shared/find-in-page.ts             # parseFindInPageRequest / findResultFromEvent
src/shared/ipc.ts                      # get-power、power:changed、browser:find
src/preload/index.ts                   # ports[0] 守卫
src/main/services/lab-events.ts        # listProcessLabEvents
src/main/services/process-recovery.ts  # notifyMainWindowCreated、child gone 日志
src/main/windows/main.ts               # 建窗后 notify
src/main/ipc/system.ts                 # online 字段与 resume
src/main/ipc/browser.ts                # browser:find
src/renderer/src/stores/app.ts         # online
src/renderer/src/views/SystemView.vue
src/renderer/src/views/BrowserView.vue
tests/port-origin.test.ts
tests/lab-events-format.test.ts
tests/power-status.test.ts
tests/find-in-page.test.ts
```

工作目录：仓库根 `/Users/julytian/Downloads/mianshi/electron-study`。建议在 `feat/resilience-workbench` 分支实现，不要直接往 `master` 推。提交用 HEREDOC，不要 `--no-verify`，不要 push（除非用户另说）。

新 BrowserWindow 必须 `sandbox: true`、`contextIsolation: true`、`nodeIntegration: false`。本期不新开窗口。除 `browser:find` 外不要再加 invoke / event 通道。

`createMainWindow` 只在函数体末尾调用 `notifyMainWindowCreated()`，不要在模块顶层读 recovery 状态。

---

### Task 1: preload 只接受带 port 的消息

**Files:**

- Modify: `src/shared/port-origin.ts`
- Modify: `src/preload/index.ts`
- Test: `tests/port-origin.test.ts`

- [ ] **Step 1: 写失败测试**

在 `tests/port-origin.test.ts` 末尾追加：

```ts
import { shouldAcceptLabPortMessage } from '../src/shared/port-origin'

describe('shouldAcceptLabPortMessage', () => {
  it('accepts port data when a port exists', () => {
    expect(shouldAcceptLabPortMessage('port', 1)).toBe(true)
    expect(shouldAcceptLabPortMessage('port', 2)).toBe(true)
  })

  it('rejects missing ports or other data', () => {
    expect(shouldAcceptLabPortMessage('port', 0)).toBe(false)
    expect(shouldAcceptLabPortMessage('ready', 1)).toBe(false)
    expect(shouldAcceptLabPortMessage(undefined, 1)).toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run tests/port-origin.test.ts`

Expected: FAIL，找不到 `shouldAcceptLabPortMessage`

- [ ] **Step 3: 写最小实现并接线 preload**

在 `src/shared/port-origin.ts` 末尾追加：

```ts
export function shouldAcceptLabPortMessage(data: unknown, portsLength: number): boolean {
  return data === 'port' && portsLength > 0
}
```

把 `src/preload/index.ts` 的 `window` `message` 监听改成：

```ts
window.addEventListener('message', (event) => {
  if (!isTrustedPortMessageOrigin(event.origin, window.location.origin)) return
  if (!shouldAcceptLabPortMessage(event.data, event.ports.length)) return
  const port = event.ports[0]
  port.onmessage = (msg) => {
    window.dispatchEvent(new CustomEvent('lab-port', { detail: msg.data }))
  }
  ;(window as unknown as { __labPort?: MessagePort }).__labPort = port
})
```

顶部增加 `shouldAcceptLabPortMessage` 的 import。`ipcRenderer.on('port')` 不要改。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run tests/port-origin.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/port-origin.ts src/preload/index.ts tests/port-origin.test.ts
git commit -m "$(cat <<'EOF'
fix(preload): 忽略没有 MessagePort 的 port 消息

没有 ports[0] 时直接返回，避免给 undefined 挂 onmessage。

EOF
)"
```

---

### Task 2: recent-gone 用 SQL 过滤 process

**Files:**

- Modify: `src/shared/lab-event-format.ts`
- Modify: `src/main/services/lab-events.ts`
- Test: `tests/lab-events-format.test.ts`

- [ ] **Step 1: 写失败测试**

在 `src/shared/lab-event-format.ts` 尚无该常量。先在 `tests/lab-events-format.test.ts` 追加：

```ts
import { LIST_PROCESS_EVENTS_SQL } from '../src/shared/lab-event-format'

describe('LIST_PROCESS_EVENTS_SQL', () => {
  it('filters process rows in SQL and applies LIMIT', () => {
    expect(LIST_PROCESS_EVENTS_SQL).toContain("module = 'process'")
    expect(LIST_PROCESS_EVENTS_SQL).toContain('LIMIT ?')
    expect(LIST_PROCESS_EVENTS_SQL).not.toContain('SELECT * FROM lab_events ORDER BY')
  })
})
```

保留文件里现有的 `formatRecentProcessEvents` 测试，不要删。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run tests/lab-events-format.test.ts`

Expected: FAIL，找不到 `LIST_PROCESS_EVENTS_SQL`

- [ ] **Step 3: 写最小实现**

在 `src/shared/lab-event-format.ts` 顶部（`LabEventRowLike` 之前）加：

```ts
export const LIST_PROCESS_EVENTS_SQL =
  "SELECT * FROM lab_events WHERE module = 'process' ORDER BY created_at DESC LIMIT ?"
```

改 `src/main/services/lab-events.ts`：

```ts
import type { LabEvent } from '../../shared/models'
import { formatRecentProcessEvents, LIST_PROCESS_EVENTS_SQL } from '../../shared/lab-event-format'
import { getDatabase } from './db'

type LabEventRow = {
  id: number
  module: string
  action: string
  ok: number
  message: string
  created_at: number
}

function mapLabEventRows(rows: LabEventRow[]): LabEvent[] {
  return rows.map((row) => ({
    id: row.id,
    module: row.module,
    action: row.action,
    ok: Boolean(row.ok),
    message: row.message,
    createdAt: row.created_at
  }))
}

export function recordLabEvent(module: string, action: string, ok: boolean, message: string): void {
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
    .all(limit) as LabEventRow[]
  return mapLabEventRows(rows)
}

export function listProcessLabEvents(limit = 10): LabEvent[] {
  const rows = getDatabase().prepare(LIST_PROCESS_EVENTS_SQL).all(limit) as LabEventRow[]
  return mapLabEventRows(rows)
}

export function recentProcessEventsMessage(limit = 10): string {
  return formatRecentProcessEvents(listProcessLabEvents(limit), limit)
}
```

不要再调用 `listLabEvents(50)` 再滤。`listLabEvents` 给 `lab:events` 用，保持原样。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run tests/lab-events-format.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/lab-event-format.ts src/main/services/lab-events.ts tests/lab-events-format.test.ts
git commit -m "$(cat <<'EOF'
fix(实验室): recent-gone 改为 SQL 过滤 process

避免先取 50 条再内存过滤，查询直接带 LIMIT。

EOF
)"
```

---

### Task 3: 主窗重建重置计数，子进程 gone 写日志

**Files:**

- Modify: `src/main/services/process-recovery.ts`
- Modify: `src/main/windows/main.ts`

这是接线，没有新的纯函数可测。不要为了测而去 mock Electron。

- [ ] **Step 1: 导出 `notifyMainWindowCreated`**

在 `src/main/services/process-recovery.ts` 增加：

```ts
export function notifyMainWindowCreated(): void {
  consecutiveReloads = 0
  hookMainLoadReset()
}
```

`hookMainLoadReset` 保持不导出。`render-process-gone` 里若判定为主窗，只调用 `hookMainLoadReset()`，不要调用 `notifyMainWindowCreated()`。

把 `child-process-gone` 改成先拼 message 再记日志：

```ts
app.on('child-process-gone', (_event, details) => {
  const message = formatChildProcessGoneMessage({
    type: details.type || 'unknown',
    reason: details.reason || 'unknown',
    exitCode: details.exitCode ?? 'unknown'
  })
  log.warn(message)
  recordLabEvent('process', 'child-process-gone', false, message)
})
```

`attachProcessRecovery` 开头仍可调用一次 `hookMainLoadReset()`（窗可能还不在，空转即可）。

- [ ] **Step 2: 建窗后通知**

`src/main/windows/main.ts` 增加：

```ts
import { notifyMainWindowCreated } from '../services/process-recovery'
```

`createMainWindow` 在 `loadMainWindow(mainWindow, hash)` 之后、`return mainWindow` 之前加一行：

```ts
notifyMainWindowCreated()
```

不要在 `index.ts` 再散落调用。`sandbox` / `contextIsolation` / `nodeIntegration` 保持现有值，不要改 `webPreferences`。

- [ ] **Step 3: 确认现有进程测试仍过**

Run: `pnpm exec vitest run tests/process-gone.test.ts`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/main/services/process-recovery.ts src/main/windows/main.ts
git commit -m "$(cat <<'EOF'
fix(韧性): 主窗重建时重置 reload 计数

新建主窗后清零连续 reload，子进程 gone 同步写入主进程日志。

EOF
)"
```

---

### Task 4: 电源快照带 online

**Files:**

- Create: `src/shared/power-status.ts`
- Test: `tests/power-status.test.ts`

- [ ] **Step 1: 写失败测试**

Create `tests/power-status.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { powerChangedPayload, powerSnapshot, readOnlineFlag } from '../src/shared/power-status'

describe('powerSnapshot', () => {
  it('maps injected online flags', () => {
    expect(powerSnapshot({ onBattery: true, idleState: 'active', isOnline: true })).toEqual({
      onBattery: true,
      idleState: 'active',
      online: true
    })
    expect(powerSnapshot({ onBattery: false, idleState: 'idle', isOnline: false })).toEqual({
      onBattery: false,
      idleState: 'idle',
      online: false
    })
  })
})

describe('powerChangedPayload', () => {
  it('omits idle state', () => {
    expect(powerChangedPayload({ onBattery: true, isOnline: false })).toEqual({
      onBattery: true,
      online: false
    })
  })
})

describe('readOnlineFlag', () => {
  it('returns false when the probe throws', () => {
    expect(readOnlineFlag(() => true)).toBe(true)
    expect(
      readOnlineFlag(() => {
        throw new Error('offline probe failed')
      })
    ).toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run tests/power-status.test.ts`

Expected: FAIL，找不到 `../src/shared/power-status`

- [ ] **Step 3: 写最小实现**

Create `src/shared/power-status.ts`:

```ts
export function readOnlineFlag(isOnline: () => boolean): boolean {
  try {
    return isOnline()
  } catch {
    return false
  }
}

export function powerSnapshot(input: {
  onBattery: boolean
  idleState: string
  isOnline: boolean
}): { onBattery: boolean; idleState: string; online: boolean } {
  return {
    onBattery: input.onBattery,
    idleState: input.idleState,
    online: input.isOnline
  }
}

export function powerChangedPayload(input: { onBattery: boolean; isOnline: boolean }): {
  onBattery: boolean
  online: boolean
} {
  return { onBattery: input.onBattery, online: input.isOnline }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run tests/power-status.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/power-status.ts tests/power-status.test.ts
git commit -m "$(cat <<'EOF'
feat(系统): 为电源状态增加 online 字段

探测失败视为离线，推送载荷不带 idleState。

EOF
)"
```

---

### Task 5: 系统页展示在线状态

**Files:**

- Modify: `src/shared/ipc.ts`
- Modify: `src/main/ipc/system.ts`
- Modify: `src/renderer/src/stores/app.ts`
- Modify: `src/renderer/src/views/SystemView.vue`

- [ ] **Step 1: 改 IPC 类型**

`src/shared/ipc.ts` 里 `system:get-power` 的 result 改为：

```ts
  'system:get-power': {
    args: []
    result: { onBattery: boolean; idleState: string; online: boolean }
  }
```

`EventMap` 里 `power:changed` 改为：

```ts
  'power:changed': { onBattery: boolean; online: boolean }
```

不要新增 event 通道名。

- [ ] **Step 2: 主进程接线**

`src/main/ipc/system.ts` 增加 `net`，以及：

```ts
import { powerChangedPayload, powerSnapshot, readOnlineFlag } from '../../shared/power-status'
```

`system:get-power`：

```ts
ipcMain.handle('system:get-power', () =>
  ipcOk(
    powerSnapshot({
      onBattery: powerMonitor.isOnBatteryPower(),
      idleState: powerMonitor.getSystemIdleState(60),
      isOnline: readOnlineFlag(() => net.isOnline())
    })
  )
)
```

`sendPower`：

```ts
const sendPower = (): void => {
  const win = getMainWindow()
  if (!win || win.isDestroyed()) return
  win.webContents.send(
    'power:changed',
    powerChangedPayload({
      onBattery: powerMonitor.isOnBatteryPower(),
      isOnline: readOnlineFlag(() => net.isOnline())
    })
  )
}
powerMonitor.on('on-ac', sendPower)
powerMonitor.on('on-battery', sendPower)
powerMonitor.on('resume', sendPower)
```

import 行改为 `import { app, ipcMain, nativeTheme, net, Notification, powerMonitor } from 'electron'`。不要加定时轮询。

- [ ] **Step 3: store 与系统页**

`src/renderer/src/stores/app.ts`：`onBattery` 旁增加 `const online = ref<boolean | null>(null)`。`power:changed` 里同时赋值：

```ts
window.api.on('power:changed', (payload) => {
  onBattery.value = payload.onBattery
  online.value = payload.online
})
```

`return` 里导出 `online`。

`src/renderer/src/views/SystemView.vue` 改成：

```vue
<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue'
import type { ThemeMode } from '@shared/models'
import { invokeIpc } from '../composables/useIpc'
import { useAppStore } from '../stores/app'

const store = useAppStore()
const power = shallowRef<{ onBattery: boolean; idleState: string; online: boolean } | null>(null)
const loginEnabled = computed(() => store.settings.behavior.openAtLogin)
const theme = computed(() => store.settings.appearance.theme)
const batteryOn = computed(() =>
  store.onBattery !== null ? store.onBattery : (power.value?.onBattery ?? null)
)
const networkOn = computed(() =>
  store.online !== null ? store.online : (power.value?.online ?? null)
)

const themeOptions: Array<{ value: ThemeMode; label: string }> = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' }
]

async function refreshSettings(): Promise<void> {
  store.settings = await invokeIpc('conf:get')
}

async function notify(): Promise<void> {
  await invokeIpc('system:notify', {
    title: 'Electron Lab',
    body: '点击通知可回到系统能力页',
    route: '/workbench/system'
  })
}

async function readPower(): Promise<void> {
  power.value = await invokeIpc('system:get-power')
}

async function setTheme(value: ThemeMode): Promise<void> {
  await invokeIpc('system:set-theme', value)
  await refreshSettings()
}

async function setLogin(enabled: boolean): Promise<void> {
  try {
    await invokeIpc('system:set-login', enabled)
  } catch {
    // invokeIpc 已 toast E_PLATFORM
  }
  await refreshSettings()
}

onMounted(() => {
  void readPower()
})
</script>

<template>
  <a-space direction="vertical" class="system-page" :size="16">
    <a-card title="系统能力">
      <a-space direction="vertical" :size="16" class="system-page">
        <a-space wrap>
          <a-button type="primary" @click="notify">发通知</a-button>
          <a-button @click="readPower">读电源</a-button>
        </a-space>
        <a-descriptions
          v-if="batteryOn !== null || networkOn !== null || power"
          bordered
          :column="1"
          size="small"
        >
          <a-descriptions-item v-if="batteryOn !== null" label="电池供电">
            {{ batteryOn ? '是' : '否' }}
          </a-descriptions-item>
          <a-descriptions-item v-if="networkOn !== null" label="网络">
            {{ networkOn ? '在线' : '离线' }}
          </a-descriptions-item>
          <a-descriptions-item v-if="power" label="空闲状态">
            {{ power.idleState }}
          </a-descriptions-item>
        </a-descriptions>
        <a-form layout="vertical">
          <a-form-item label="主题切换">
            <a-radio-group :value="theme" @update:value="setTheme">
              <a-radio-button v-for="item in themeOptions" :key="item.value" :value="item.value">
                {{ item.label }}
              </a-radio-button>
            </a-radio-group>
          </a-form-item>
          <a-form-item label="开机自启">
            <a-switch :checked="loginEnabled" @change="setLogin" />
          </a-form-item>
        </a-form>
      </a-space>
    </a-card>
  </a-space>
</template>

<style scoped>
.system-page {
  width: 100%;
}
</style>
```

不要加底栏指示。不要改 `app:get-info`。

- [ ] **Step 4: 类型检查相关文件**

Run: `pnpm typecheck`

Expected: 无错误。若 `power:changed` 旧载荷漏改，补上 `online`。

- [ ] **Step 5: Commit**

```bash
git add src/shared/ipc.ts src/main/ipc/system.ts src/renderer/src/stores/app.ts src/renderer/src/views/SystemView.vue
git commit -m "$(cat <<'EOF'
feat(系统): 系统页展示在线状态

电源读取与推送都带 online，进入页面时拉一次。

EOF
)"
```

---

### Task 6: 查找参数解析

**Files:**

- Create: `src/shared/find-in-page.ts`
- Test: `tests/find-in-page.test.ts`

- [ ] **Step 1: 写失败测试**

Create `tests/find-in-page.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  FIND_IN_PAGE_TIMEOUT_MS,
  emptyFindMatch,
  findResultFromEvent,
  parseFindInPageRequest
} from '../src/shared/find-in-page'

describe('parseFindInPageRequest', () => {
  it('rejects invalid action or query type', () => {
    expect(parseFindInPageRequest('hi', 'jump')).toEqual({
      ok: false,
      message: '查找动作无效'
    })
    expect(parseFindInPageRequest(1, 'next')).toEqual({
      ok: false,
      message: '查找关键字无效'
    })
  })

  it('allows empty query only for stop', () => {
    expect(parseFindInPageRequest('   ', 'next')).toEqual({
      ok: false,
      message: '查找关键字不能为空'
    })
    expect(parseFindInPageRequest('', 'stop')).toEqual({ ok: true, kind: 'stop' })
  })

  it('builds next and previous options', () => {
    expect(parseFindInPageRequest('hello', 'next')).toEqual({
      ok: true,
      kind: 'find',
      query: 'hello',
      options: { forward: true, findNext: true }
    })
    expect(parseFindInPageRequest('hello', 'previous')).toEqual({
      ok: true,
      kind: 'find',
      query: 'hello',
      options: { forward: false, findNext: true }
    })
  })
})

describe('findResultFromEvent', () => {
  it('ignores partial updates and normalizes finals', () => {
    expect(findResultFromEvent({ finalUpdate: false, activeMatchOrdinal: 1, matches: 3 })).toBe(
      null
    )
    expect(findResultFromEvent({ finalUpdate: true, activeMatchOrdinal: 2, matches: 4 })).toEqual({
      activeMatchOrdinal: 2,
      matches: 4
    })
    expect(findResultFromEvent({ finalUpdate: true })).toEqual(emptyFindMatch())
  })

  it('uses a two second timeout', () => {
    expect(FIND_IN_PAGE_TIMEOUT_MS).toBe(2000)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run tests/find-in-page.test.ts`

Expected: FAIL，找不到 `../src/shared/find-in-page`

- [ ] **Step 3: 写最小实现**

Create `src/shared/find-in-page.ts`:

```ts
export const FIND_IN_PAGE_TIMEOUT_MS = 2000

export type FindInPageAction = 'next' | 'previous' | 'stop'

export type FindMatch = { activeMatchOrdinal: number; matches: number }

export type FindInPageParsed =
  | { ok: false; message: string }
  | { ok: true; kind: 'stop' }
  | { ok: true; kind: 'find'; query: string; options: { forward: boolean; findNext: true } }

export function emptyFindMatch(): FindMatch {
  return { activeMatchOrdinal: 0, matches: 0 }
}

export function parseFindInPageRequest(query: unknown, action: unknown): FindInPageParsed {
  if (action !== 'next' && action !== 'previous' && action !== 'stop') {
    return { ok: false, message: '查找动作无效' }
  }
  if (typeof query !== 'string') {
    return { ok: false, message: '查找关键字无效' }
  }
  if (action === 'stop') {
    return { ok: true, kind: 'stop' }
  }
  if (query.trim() === '') {
    return { ok: false, message: '查找关键字不能为空' }
  }
  return {
    ok: true,
    kind: 'find',
    query,
    options: { forward: action === 'next', findNext: true }
  }
}

export function findResultFromEvent(result: {
  finalUpdate?: boolean
  activeMatchOrdinal?: number
  matches?: number
}): FindMatch | null {
  if (!result.finalUpdate) return null
  return {
    activeMatchOrdinal: result.activeMatchOrdinal ?? 0,
    matches: result.matches ?? 0
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run tests/find-in-page.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/find-in-page.ts tests/find-in-page.test.ts
git commit -m "$(cat <<'EOF'
feat(浏览): 抽出页内查找参数解析

非法动作与空关键字在进 Electron API 之前就被挡住。

EOF
)"
```

---

### Task 7: `browser:find` IPC

**Files:**

- Modify: `src/shared/ipc.ts`
- Modify: `src/main/ipc/browser.ts`

- [ ] **Step 1: 登记通道**

在 `invokeChannels` 的 `'browser:go': true,` 后加：

```ts
  'browser:find': true,
```

在 `InvokeMap` 的 `'browser:go'` 后加：

```ts
  'browser:find': {
    args: [query: string, action: 'next' | 'previous' | 'stop']
    result: { activeMatchOrdinal: number; matches: number }
  }
```

不要加 `browser:found` event。

- [ ] **Step 2: 实现 handler**

在 `src/main/ipc/browser.ts` 增加 import：

```ts
import {
  FIND_IN_PAGE_TIMEOUT_MS,
  emptyFindMatch,
  findResultFromEvent,
  parseFindInPageRequest
} from '../../shared/find-in-page'
```

在 `goBrowser` 后追加（保持文件内其它函数不变）：

```ts
type FindWait = {
  resolve: (value: { activeMatchOrdinal: number; matches: number }) => void
  cleanup: () => void
}

let findWait: FindWait | null = null

function cancelFindWait(): void {
  if (!findWait) return
  const pending = findWait
  findWait = null
  pending.cleanup()
  pending.resolve(emptyFindMatch())
}

function waitForFind(
  wc: Electron.WebContents
): Promise<{ activeMatchOrdinal: number; matches: number }> {
  cancelFindWait()
  return new Promise((resolve) => {
    const onFound = (_event: Electron.Event, result: Electron.Result): void => {
      const picked = findResultFromEvent(result)
      if (!picked) return
      finish(picked)
    }
    const timer = setTimeout(() => {
      finish(emptyFindMatch())
    }, FIND_IN_PAGE_TIMEOUT_MS)
    const cleanup = (): void => {
      clearTimeout(timer)
      if (!wc.isDestroyed()) wc.removeListener('found-in-page', onFound)
    }
    const finish = (value: { activeMatchOrdinal: number; matches: number }): void => {
      if (findWait?.cleanup !== cleanup) return
      findWait = null
      cleanup()
      resolve(value)
    }
    findWait = { resolve, cleanup }
    wc.on('found-in-page', onFound)
  })
}

async function findInBrowser(
  query: unknown,
  action: unknown
): Promise<IpcResult<{ activeMatchOrdinal: number; matches: number }>> {
  const parsed = parseFindInPageRequest(query, action)
  if (!parsed.ok) {
    return ipcError(errorCodes.VALIDATION, parsed.message)
  }
  const wc = browserView?.webContents
  if (!browserView || !wc || wc.isDestroyed()) {
    return ipcError(errorCodes.VALIDATION, '浏览器尚未创建')
  }
  if (parsed.kind === 'stop') {
    cancelFindWait()
    wc.stopFindInPage('clearSelection')
    return ipcOk(emptyFindMatch())
  }
  const pending = waitForFind(wc)
  wc.findInPage(parsed.query, parsed.options)
  return ipcOk(await pending)
}
```

`registerBrowserIpc` 增加：

```ts
ipcMain.handle('browser:find', (_event, query: unknown, action: unknown) =>
  findInBrowser(query, action)
)
```

若 `Electron.Result` 类型报错，改成 `Parameters<Parameters<Electron.WebContents['on'] & Function>[1]>` 太绕。用：

```ts
result: { finalUpdate?: boolean; activeMatchOrdinal?: number; matches?: number }
```

不要改网址放行、`persist:browser`、沙箱偏好。

- [ ] **Step 3: 跑查找测试与类型检查**

Run:

```bash
pnpm exec vitest run tests/find-in-page.test.ts tests/browser-policy.test.ts
pnpm typecheck
```

Expected: 测试 PASS；`typecheck` 无错误。

- [ ] **Step 4: Commit**

```bash
git add src/shared/ipc.ts src/main/ipc/browser.ts
git commit -m "$(cat <<'EOF'
feat(浏览): 增加 browser:find 页内查找

等 found-in-page 的 finalUpdate；超时或重入视为 0/0。

EOF
)"
```

---

### Task 8: 迷你浏览器查找条

**Files:**

- Modify: `src/renderer/src/views/BrowserView.vue`

- [ ] **Step 1: 加上查找工具栏**

把 `src/renderer/src/views/BrowserView.vue` 换成：

```vue
<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef } from 'vue'
import { invokeIpc } from '../composables/useIpc'

const url = shallowRef('')
const canBack = shallowRef(false)
const canForward = shallowRef(false)
const query = shallowRef('')
const matchOrdinal = shallowRef(0)
const matchCount = shallowRef(0)

let offNav: (() => void) | undefined

onMounted(async () => {
  offNav = window.api.on('browser:nav', (payload) => {
    url.value = payload.url
    canBack.value = payload.canBack
    canForward.value = payload.canForward
  })
  await invokeIpc('browser:create')
})

onBeforeUnmount(() => {
  offNav?.()
})

async function navigate(): Promise<void> {
  await invokeIpc('browser:navigate', url.value)
}

async function go(action: 'back' | 'forward' | 'reload'): Promise<void> {
  await invokeIpc('browser:go', action)
}

async function applyFind(action: 'next' | 'previous' | 'stop'): Promise<void> {
  try {
    const result = await invokeIpc('browser:find', query.value, action)
    matchOrdinal.value = result.activeMatchOrdinal
    matchCount.value = result.matches
  } catch {
    // invokeIpc 已 toast
  }
}

async function findNext(): Promise<void> {
  await applyFind('next')
}

async function findPrevious(): Promise<void> {
  await applyFind('previous')
}

async function onQueryChange(value: string): Promise<void> {
  query.value = value
  if (value.trim() === '') {
    await applyFind('stop')
  }
}
</script>

<template>
  <div class="browser-page">
    <a-space class="browser-toolbar" :size="8">
      <a-button :disabled="!canBack" @click="go('back')">后退</a-button>
      <a-button :disabled="!canForward" @click="go('forward')">前进</a-button>
      <a-button @click="go('reload')">刷新</a-button>
      <a-input
        v-model:value="url"
        class="browser-url"
        placeholder="输入 https 地址或 example.com"
        allow-clear
        @press-enter="navigate"
      />
      <a-button type="primary" @click="navigate">前往</a-button>
    </a-space>
    <a-space class="browser-toolbar browser-find" :size="8">
      <a-input
        :value="query"
        class="browser-find-input"
        placeholder="页内查找"
        allow-clear
        @update:value="onQueryChange"
        @press-enter="findNext"
      />
      <a-button @click="findPrevious">上一个</a-button>
      <a-button @click="findNext">下一个</a-button>
      <span class="browser-find-count">{{ matchOrdinal }} / {{ matchCount }}</span>
    </a-space>
  </div>
</template>

<style scoped>
.browser-page {
  width: 100%;
}

.browser-toolbar {
  width: 100%;
}

.browser-find {
  margin-top: 8px;
}

.browser-url {
  min-width: 280px;
  flex: 1;
}

.browser-find-input {
  min-width: 200px;
}

.browser-find-count {
  color: rgba(0, 0, 0, 0.45);
  white-space: nowrap;
}
</style>
```

不要改实验室 catalog。不要把查找计数塞进 `browser:nav`。

- [ ] **Step 2: 类型检查页面**

Run: `pnpm typecheck`

Expected: 无错误。

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/views/BrowserView.vue
git commit -m "$(cat <<'EOF'
feat(浏览): 迷你浏览器增加页内查找条

输入关键字后可查上一个和下一个，并显示当前匹配计数。

EOF
)"
```

---

### Task 9: 全量验证

**Files:** 无新文件（只修检查暴露的问题）

- [ ] **Step 1: 跑完整检查**

```bash
pnpm test
pnpm typecheck
pnpm lint
```

Expected:

- `pnpm test`：全部通过，含 port-origin / lab-events-format / power-status / find-in-page
- `pnpm typecheck`：无错误
- `pnpm lint`：无错误

若有失败，先修再重新跑同一组命令，不要宣称完成。

- [ ] **Step 2: 对照规格扫一遍**

确认这些都已落地：

- `createMainWindow` 末尾调用 `notifyMainWindowCreated()`
- `render-process-gone` 不调用 `notifyMainWindowCreated()`
- `child-process-gone` 有 `log.warn`
- `recentProcessEventsMessage` 走 `listProcessLabEvents`，SQL 含 `module = 'process'`
- preload 用 `shouldAcceptLabPortMessage`，不直接解包可能为空的 `ports[0]`
- `system:get-power` / `power:changed` 带 `online`；系统页有「网络」行
- 只有新增 invoke `browser:find`，无新 event
- 实验室 catalog 未加查找动作

- [ ] **Step 3: 若 Step 1 修过文件则再提交**

只在有改动时：

```bash
git add -u
git commit -m "$(cat <<'EOF'
fix: 收口加固与工作台边角的类型与检查

全量 test / typecheck / lint 通过后再收尾。

EOF
)"
```

不要 push。手验（系统页在线、浏览器查找计数、清空回 0/0）留给用户在 `pnpm dev` 里做。

---

## Self-review

| 规格条目               | 任务                   |
| ---------------------- | ---------------------- |
| 3.1 主窗重建重置计数   | Task 3                 |
| 3.2 子进程 gone 写日志 | Task 3                 |
| 3.3 recent-gone SQL    | Task 2                 |
| 3.4 preload ports[0]   | Task 1                 |
| 4 在线状态             | Task 4、Task 5         |
| 5 页内查找             | Task 6、Task 7、Task 8 |
| 6 错误码               | Task 6、Task 7         |
| 7 测试与手验           | 各 TDD 任务 + Task 9   |

未覆盖（刻意）：Playwright、发布/CI、实验室 B 期、`browser:found`、笔记导入导出。
