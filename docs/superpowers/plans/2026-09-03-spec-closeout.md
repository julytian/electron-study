# 规格收口 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 收口原设计缺口：最近文件进文件页与命令面板，镜像系统最近文档 / Jump List；主题与电源事件真推送；日志按天切割；设置页开机自启。

**Architecture:** SQLite `recent_files` 为权威；`app.addRecentDocument` 与 Jump List 是镜像。打开最近项视为用户授权，写入会话 allowlist。主题 / 电源走已有 event 通道。渲染只 `window.api`。

**Tech Stack:** 现有 Electron Lab（electron-vite、Vue 3、ant-design-vue、better-sqlite3、Vitest）。不新加 npm 包。

**Spec:** `docs/superpowers/specs/2026-09-03-spec-closeout-design.md`

---

## File map

```
src/shared/ipc.ts                      # 增加 files:recent / open-recent / forget
src/shared/models.ts                   # RecentFile 已存在，ipc 需 import
src/main/services/recent-sync.ts       # 去重、过滤、截断、重建顺序（可单测）
src/main/services/daily-log.ts         # main-YYYY-MM-DD.log 文件名（可单测）
src/main/services/files.ts             # upsert / list / forget / openRecent
src/main/services/recent-documents.ts  # add/clear/rebuild 系统最近文档（包一层，方便测注入）
src/main/ipc/files.ts
src/main/index.ts                      # 启动 purge + rebuild
src/main/platforms/win.ts              # Jump List 加 type: recent，limit 15
src/main/platforms/recent-paths.ts     # 默认 limit 改为 15（与规格一致）
src/main/ipc/system.ts                 # nativeTheme / powerMonitor 推事件
src/main/services/logger.ts
src/renderer/src/composables/useFiles.ts
src/renderer/src/views/FilesView.vue
src/renderer/src/components/CommandPalette.vue
src/renderer/src/views/SettingsView.vue
src/renderer/src/stores/app.ts
src/renderer/src/views/SystemView.vue
tests/recent-sync.test.ts
tests/daily-log.test.ts
tests/recent-paths.test.ts
```

工作目录：仓库根 `/Users/julytian/Downloads/mianshi/electron-study`。提交用 HEREDOC，不要 `--no-verify`，不要 push（除非用户另说）。

---

### Task 1: 最近文件纯函数

**Files:**

- Create: `src/main/services/recent-sync.ts`
- Test: `tests/recent-sync.test.ts`
- Modify: `src/main/platforms/recent-paths.ts`（默认 `limit` 从 5 改为 15）
- Modify: `tests/recent-paths.test.ts`（若有断言默认 5 条则改为 15）

- [ ] **Step 1: 写失败测试**

Create `tests/recent-sync.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  RECENT_FILE_LIMIT,
  dedupeRecentRows,
  filterExistingPaths,
  pathsForSystemRecent
} from '../src/main/services/recent-sync'

describe('dedupeRecentRows', () => {
  it('keeps the newest row per path', () => {
    const rows = [
      { path: '/a.md', openedAt: 2 },
      { path: '/a.md', openedAt: 1 },
      { path: '/b.md', openedAt: 3 }
    ]
    expect(dedupeRecentRows(rows)).toEqual([
      { path: '/b.md', openedAt: 3 },
      { path: '/a.md', openedAt: 2 }
    ])
  })
})

describe('filterExistingPaths', () => {
  it('drops missing files', () => {
    const exists = (p: string) => p === '/keep.md'
    expect(filterExistingPaths(['/keep.md', '/gone.md'], exists)).toEqual(['/keep.md'])
  })
})

describe('pathsForSystemRecent', () => {
  it('dedupes, filters, sorts newest first, and caps at 15', () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({
      path: `/f${i}.md`,
      openedAt: i
    }))
    const exists = () => true
    const paths = pathsForSystemRecent(rows, exists)
    expect(paths).toHaveLength(RECENT_FILE_LIMIT)
    expect(paths[0]).toBe('/f19.md')
    expect(paths[14]).toBe('/f5.md')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm exec vitest run tests/recent-sync.test.ts
```

Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现**

Create `src/main/services/recent-sync.ts`:

```ts
export const RECENT_FILE_LIMIT = 15

export interface RecentRow {
  path: string
  openedAt: number
}

export function dedupeRecentRows(rows: RecentRow[]): RecentRow[] {
  const newest = new Map<string, RecentRow>()
  for (const row of rows) {
    const current = newest.get(row.path)
    if (!current || row.openedAt > current.openedAt) newest.set(row.path, row)
  }
  return [...newest.values()].sort((a, b) => b.openedAt - a.openedAt)
}

export function filterExistingPaths(paths: string[], exists: (p: string) => boolean): string[] {
  return paths.filter((p) => p && exists(p))
}

export function pathsForSystemRecent(
  rows: RecentRow[],
  exists: (p: string) => boolean
): string[] {
  return filterExistingPaths(
    dedupeRecentRows(rows).map((row) => row.path),
    exists
  ).slice(0, RECENT_FILE_LIMIT)
}
```

`recent-paths.ts` 把默认 `limit = 5` 改成 `limit = 15`。

- [ ] **Step 4: 测试通过**

```bash
pnpm exec vitest run tests/recent-sync.test.ts tests/recent-paths.test.ts
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/main/services/recent-sync.ts tests/recent-sync.test.ts src/main/platforms/recent-paths.ts tests/recent-paths.test.ts
git commit -m "$(cat <<'EOF'
feat: 添加最近文件去重与截断纯函数

EOF
)"
```

---

### Task 2: 按天日志文件名

**Files:**

- Create: `src/main/services/daily-log.ts`
- Test: `tests/daily-log.test.ts`
- Modify: `src/main/services/logger.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { dailyLogFileName } from '../src/main/services/daily-log'

describe('dailyLogFileName', () => {
  it('uses main-YYYY-MM-DD.log in local time', () => {
    expect(dailyLogFileName(new Date(2026, 8, 3))).toBe('main-2026-09-03.log')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm exec vitest run tests/daily-log.test.ts
```

Expected: FAIL。

- [ ] **Step 3: 实现并接到 logger**

```ts
export function dailyLogFileName(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `main-${y}-${m}-${d}.log`
}
```

`logger.ts` 的 `resolvePathFn` 改为 `join(logsDir, dailyLogFileName())`。保留 `maxSize = 1024 * 1024`。

- [ ] **Step 4: 测试通过**

```bash
pnpm exec vitest run tests/daily-log.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/main/services/daily-log.ts src/main/services/logger.ts tests/daily-log.test.ts
git commit -m "$(cat <<'EOF'
feat: 主进程日志按天切割文件名

EOF
)"
```

---

### Task 3: IPC 契约

**Files:**

- Modify: `src/shared/ipc.ts`

- [ ] **Step 1: 在 `invokeChannels` 的 `files:add-recent` 后增加**

```ts
  'files:recent': true,
  'files:open-recent': true,
  'files:forget': true,
```

`ipc.ts` 顶部 `import type` 增加 `RecentFile`。

`InvokeMap` 增加：

```ts
  'files:recent': { args: []; result: RecentFile[] }
  'files:open-recent': { args: [target: string]; result: { path: string; content?: string } }
  'files:forget': { args: [target?: string]; result: null }
```

不要改 event 通道。不要改 preload 结构。

- [ ] **Step 2: typecheck**

```bash
pnpm typecheck
```

Expected: 通过（新通道还没有 handle 不影响 typecheck）。

- [ ] **Step 3: Commit**

```bash
git add src/shared/ipc.ts
git commit -m "$(cat <<'EOF'
feat: 添加最近文件 IPC 通道

EOF
)"
```

---

### Task 4: 文件服务 upsert / list / openRecent / forget

**Files:**

- Modify: `src/main/services/files.ts`
- Modify: `tests/files.test.ts`

- [ ] **Step 1: 给 `FilesService` 增加方法（测试先写调用）**

在 `tests/files.test.ts` 增加用例（沿用现有临时库 / 临时文件夹套路）：

1. `remember` 同一 path 两次，`listRecent()` 只有 1 行且 `openedAt` 更新。
2. `openRecent` 对存在的文本文件返回 `content`。
3. `forget(path)` 后列表不再含该 path。
4. `forget()` 无参清空。

先跑：`pnpm exec vitest run tests/files.test.ts` —— 新用例 FAIL。

- [ ] **Step 2: 实现**

`insertRecentFile` 改为 upsert：

```ts
export function insertRecentFile(db: Database.Database, filePath: string): void {
  const now = Date.now()
  const existing = db.prepare('SELECT id FROM recent_files WHERE path = ?').get(filePath) as
    | { id: number }
    | undefined
  if (existing) {
    db.prepare('UPDATE recent_files SET opened_at = ? WHERE id = ?').run(now, existing.id)
    return
  }
  db.prepare('INSERT INTO recent_files (path, opened_at) VALUES (?, ?)').run(filePath, now)
}
```

`FilesService` 增加：

```ts
  listRecent(): RecentFile[]
  openRecent(target: string): { path: string; content?: string }
  forget(target?: string): void
```

- `listRecent`：`SELECT id, path, opened_at FROM recent_files ORDER BY opened_at DESC`，用 `existsSync` 过滤，映射 `{ id, path, openedAt }`，截断 `RECENT_FILE_LIMIT`。
- `openRecent`：`resolve`；`existsSync` 否则抛 `name: 'E_NOT_FOUND'` 的 Error（message 含 `E_NOT_FOUND`），并 `DELETE FROM recent_files WHERE path = ?`；然后 `allowlist.add`，按 `MAX_TEXT_BYTES` 读正文（与 `open()` 相同）。
- `forget(target?)`：有 target 则 `DELETE WHERE path = ?` 并 `allowlist.delete`；无 target 则删全部 recent 行。

从 `recent-sync.ts` import `RECENT_FILE_LIMIT`。

- [ ] **Step 3: 测试通过**

```bash
pnpm exec vitest run tests/files.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/main/services/files.ts tests/files.test.ts
git commit -m "$(cat <<'EOF'
feat: 最近文件支持去重列表与按路径打开

EOF
)"
```

---

### Task 5: 系统最近文档镜像、IPC、启动清理

**Files:**

- Create: `src/main/services/recent-documents.ts`
- Modify: `src/main/ipc/files.ts`
- Modify: `src/main/index.ts`
- Modify: `src/main/platforms/win.ts`

- [ ] **Step 1: `recent-documents.ts`**

```ts
import { app } from 'electron'
import { existsSync } from 'node:fs'
import { getDatabase } from './db'
import { pathsForSystemRecent, type RecentRow } from './recent-sync'
import { refreshWindowsJumpList } from '../platforms/win'

export function queryRecentRows(): RecentRow[] {
  return (
    getDatabase()
      .prepare('SELECT path, opened_at AS openedAt FROM recent_files ORDER BY opened_at DESC')
      .all() as RecentRow[]
  )
}

export function purgeMissingRecentFiles(): number {
  const db = getDatabase()
  const rows = queryRecentRows()
  let removed = 0
  for (const row of rows) {
    if (existsSync(row.path)) continue
    db.prepare('DELETE FROM recent_files WHERE path = ?').run(row.path)
    removed += 1
  }
  return removed
}

export function rebuildSystemRecentDocuments(): void {
  try {
    app.clearRecentDocuments()
    for (const filePath of pathsForSystemRecent(queryRecentRows(), existsSync)) {
      app.addRecentDocument(filePath)
    }
  } catch (error) {
    // 部分平台 / 开发态可能不支持
    console.warn(error)
  }
}

export function rememberSystemDocument(filePath: string): void {
  try {
    app.addRecentDocument(filePath)
  } catch {
    // 忽略
  }
}

export function syncRecentMirrors(): void {
  rebuildSystemRecentDocuments()
  if (process.platform === 'win32') {
    try {
      refreshWindowsJumpList()
    } catch {
      // 非 Windows 或 API 失败
    }
  }
}
```

注意：`win.ts` 已 import `getDatabase`。为避免循环，`syncRecentMirrors` 里动态 import 也可以；优先让 `win.ts` **不要** import `recent-documents.ts`。`files.ts` 服务在 remember 时由 IPC 层调用 `rememberSystemDocument`，不要在纯 `files.ts` 里 import `electron` 的 `app`。

- [ ] **Step 2: `files.ts` 的 `remember` / `open` / `save` 不直接调 app。** IPC 层在成功 remember 后调 `rememberSystemDocument` + `syncRecentMirrors` 太重；规格写「写入时 addRecentDocument」。IPC：

```ts
  ipcMain.handle('files:open', () =>
    wrap(async () => {
      const result = await files().open()
      if (result) {
        rememberSystemDocument(result.path)
        if (process.platform === 'win32') {
          try {
            refreshWindowsJumpList()
          } catch {
            /* ignore */
          }
        }
      }
      return result
    })
  )
```

`files:save`、`files:open-recent` 同样。`rememberOpened`（protocol）成功后也调 `rememberSystemDocument` + 可选 Jump List。

`files:recent` → `ipcOk(files().listRecent())`  
`files:open-recent` → wrap，成功后镜像  
`files:forget` → wrap `files().forget(target)` 然后 `rebuildSystemRecentDocuments` + Jump List

`wrap` 已有：`E_PATH` → PATH；把 `E_NOT_FOUND` 也映射到 `errorCodes.NOT_FOUND`。

- [ ] **Step 3: `win.ts` `setJumpList` 改为**

```ts
  const paths = existingRecentPaths(queryRecentFileRows(), existsSync, 15)
  app.setJumpList([
    { type: 'recent' },
    {
      type: 'custom',
      name: '最近文件',
      items: paths.map((filePath) => ({ type: 'file' as const, path: filePath }))
    }
  ])
```

- [ ] **Step 4: `index.ts` 在 `openDatabase()` 成功之后、`createMainWindow()` 之前：**

```ts
  purgeMissingRecentFiles()
  rebuildSystemRecentDocuments()
```

`createMainWindow` 之后现有的 `refreshWindowsJumpList()` 保留。

- [ ] **Step 5: `pnpm typecheck` 与 `pnpm test` 通过后 Commit**

```bash
git add src/main/services/recent-documents.ts src/main/ipc/files.ts src/main/index.ts src/main/platforms/win.ts src/main/services/protocol.ts
git commit -m "$(cat <<'EOF'
feat: 同步系统最近文档并注册最近文件 IPC

EOF
)"
```

---

### Task 6: 文件页最近列表

**Files:**

- Modify: `src/renderer/src/composables/useFiles.ts`
- Modify: `src/renderer/src/views/FilesView.vue`

- [ ] **Step 1: `useFiles` 增加**

```ts
import type { RecentFile } from '@shared/models'

  const recents = ref<RecentFile[]>([])

  async function refreshRecents(): Promise<void> {
    recents.value = await invokeIpc('files:recent')
  }

  async function openRecent(target: string): Promise<void> {
    const result = await invokeIpc('files:open-recent', target)
    path.value = result.path
    if (result.content !== undefined) {
      content.value = result.content
      contentLoaded.value = true
    } else {
      content.value = ''
      contentLoaded.value = false
    }
    await refreshRecents()
  }

  async function forget(target?: string): Promise<void> {
    await invokeIpc('files:forget', target)
    await refreshRecents()
  }
```

`open` / `save` 成功后 `refreshRecents()`。`onMounted` 调 `refreshRecents`。

- [ ] **Step 2: `FilesView` 用 `<script setup lang="ts">`，在现有按钮下方加卡片「最近文件」**

- `a-list` 绑定 `recents`，空文案「还没有最近文件」
- 每项：path、时间（`new Date(item.openedAt).toLocaleString()`）
- 按钮：打开 → `openRecent(item.path)`；显示位置 → `invokeIpc('files:show-in-folder', item.path)`（先 `openRecent` 或仅 show；show 需要 allowlist，应先 `openRecent` 或主进程 `forget` 不影响 show——`showInFolder` 走 `assertAllowed`。从列表点「显示位置」应先把 path 加入 allowlist：用 `openRecent` 只为授权太重。更好：`files:open-recent` 已加 allowlist；「显示位置」先 `openRecent` 再 `showInFolder`，或增加列表项点击打开。规格：打开、显示位置、移除。显示位置：调用 `files:open-recent` 后再 `files:show-in-folder`，或让 `showInFolder` 对 recent 表内 path 放行。

**实现约定：** `files:show-in-folder` 若 path 在 `recent_files` 中则允许（`assertAllowed` 增加「在 recent 表」）。这样显示位置不必先读全文。在 Task 4 的 `assertAllowed` 里：

```ts
    const inRecent = Boolean(
      db.prepare('SELECT id FROM recent_files WHERE path = ?').get(resolved)
    )
    if (inRecent) {
      allowlist.add(resolved)
      return resolved
    }
```

放在 `allowlist.has` 之后、`assertWithinRoot` 之前。

- 移除 → `forget(item.path)`

无 `v-html`。无 Node。

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/composables/useFiles.ts src/renderer/src/views/FilesView.vue src/main/services/files.ts
git commit -m "$(cat <<'EOF'
feat: 文件页展示最近文件列表

EOF
)"
```

---

### Task 7: 命令面板搜最近文件

**Files:**

- Modify: `src/renderer/src/components/CommandPalette.vue`

- [ ] **Step 1: 打开面板时 `invokeIpc('files:recent')` 缓存到 `recents`**

列表分两组渲染：

1. 现有路由（`keyword` 匹配 title/path）
2. 最近文件：`path` 包含 `keyword`（空 keyword 也列出，最多 15）

选最近文件：

```ts
  await router.push('/workbench/files')
  await invokeIpc('files:open-recent', filePath)
```

文件页需能响应：`useFiles` 在 `onMounted` 拉列表；若从面板打开，FilesView 可能已挂载。用 `window` 自定义事件或把「待打开 path」放 `sessionStorage` 键 `electron-lab:open-recent`，FilesView `onMounted` / `onActivated` 读取。

**实现约定（不要新 IPC）：** `sessionStorage.setItem('electron-lab:open-recent', filePath)`，然后 `router.push('/workbench/files')`。`FilesView` `onMounted`：

```ts
  const pending = sessionStorage.getItem('electron-lab:open-recent')
  if (pending) {
    sessionStorage.removeItem('electron-lab:open-recent')
    await openRecent(pending)
  }
```

分组标题：「模块」「最近文件」。

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/components/CommandPalette.vue src/renderer/src/views/FilesView.vue
git commit -m "$(cat <<'EOF'
feat: 命令面板可搜索并打开最近文件

EOF
)"
```

---

### Task 8: 主题、电源、开机自启

**Files:**

- Modify: `src/main/ipc/system.ts`
- Modify: `src/renderer/src/stores/app.ts`
- Modify: `src/renderer/src/views/SettingsView.vue`
- Modify: `src/renderer/src/views/SystemView.vue`

- [ ] **Step 1: `registerSystemIpc` 末尾注册监听**

```ts
  nativeTheme.on('updated', () => {
    const win = getMainWindow()
    if (!win || win.isDestroyed()) return
    win.webContents.send('theme:changed', { theme: nativeTheme.themeSource as ThemeMode })
  })

  const sendPower = (): void => {
    const win = getMainWindow()
    if (!win || win.isDestroyed()) return
    win.webContents.send('power:changed', { onBattery: powerMonitor.isOnBatteryPower() })
  }
  powerMonitor.on('on-ac', sendPower)
  powerMonitor.on('on-battery', sendPower)
```

`system:set-theme` 在 set 之后也会触发 `updated`，不必重复 send。

- [ ] **Step 2: store `bootstrap` 订阅**

```ts
    window.api.on('theme:changed', (payload) => {
      settings.value = {
        ...settings.value,
        appearance: { ...settings.value.appearance, theme: payload.theme }
      }
    })
    window.api.on('power:changed', (payload) => {
      onBattery.value = payload.onBattery
    })
```

增加 `const onBattery = ref<boolean | null>(null)` 并导出。SystemView 优先用 `store.onBattery`，无值再显示手动 `system:get-power`。

- [ ] **Step 3: SettingsView `onTheme` 改为**

```ts
async function onTheme(theme: 'system' | 'light' | 'dark'): Promise<void> {
  await invokeIpc('system:set-theme', theme)
  store.settings = await invokeIpc('conf:get')
}
```

「通用」增加开机自启开关，逻辑与 SystemView `setLogin` 相同（`system:set-login` + 刷新 conf）。

- [ ] **Step 4: Commit**

```bash
git add src/main/ipc/system.ts src/renderer/src/stores/app.ts src/renderer/src/views/SettingsView.vue src/renderer/src/views/SystemView.vue
git commit -m "$(cat <<'EOF'
feat: 推送主题与电源变化并在设置页开放机自启

EOF
)"
```

---

### Task 9: 全量验证

- [ ] **Step 1:**

```bash
pnpm test
pnpm typecheck
```

Expected: 全部绿。

- [ ] **Step 2: 手验清单（实现者在报告里列出，不阻塞 commit）**

1. 打开一个小 `.md`，文件页最近列表出现；命令面板能搜到。
2. 删掉该文件后再点列表，应 toast 找不到并从表消失。
3. 设置改主题，整窗深浅色变；改系统外观（跟随系统时）也应变。
4. 设置开机自启拨动（失败则 toast）。
5. `userData/logs/` 出现 `main-YYYY-MM-DD.log`。

- [ ] **Step 3:** 若 Step 1 已绿且无未提交，本任务无新 commit。有漏网改动则：

```bash
git add -u
git commit -m "$(cat <<'EOF'
fix: 收口规格收口期的类型与测试

EOF
)"
```

---

## Spec 覆盖

| 规格 | 任务 |
| --- | --- |
| upsert / 15 条 / 去重 | Task 1、4 |
| addRecentDocument / 启动 purge / 重建 | Task 5 |
| Jump List `recent` + 自定义 | Task 5 |
| files:recent / open-recent / forget | Task 3、4、5 |
| 文件页列表 | Task 6 |
| 命令面板 | Task 7 |
| 路径监禁 + 列表点开授权 | Task 4 `openRecent` / `assertAllowed` |
| 主题事件 + 设置走 set-theme | Task 8 |
| 电源事件 | Task 8 |
| 开机自启进设置 | Task 8 |
| 日志按天 | Task 2 |
| 单测纯函数 | Task 1、2、4 |

C / B 不在本计划。
