# Electron Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按设计说明做出 Electron Lab：安全的 Vue3 桌面壳 + 工具页 + API 实验室，数据分层存储，更新对接 GitHub Releases。

**Architecture:** 主进程独占系统 API / SQLite / 更新；preload 只暴露 `window.api` 白名单；渲染进程是 Vue3 + ant-design-vue。契约集中在 `src/shared`。按 P0–P5 垂直切片，每一期结束必须能 `pnpm dev` 跑起来。

**Tech Stack:** Electron（最新稳定版）、electron-vite、electron-builder、Vue 3、TypeScript、Vue Router、Pinia、ant-design-vue、electron-conf、better-sqlite3、electron-updater、pnpm、Vitest。

**Spec:** `docs/superpowers/specs/2026-09-03-electron-lab-design.md`

**协议：** `electron-lab://`（笔记：`electron-lab://note/:id`）

---

## File map

创建或改动的文件职责如下。后续任务只改这些路径，不要另起一套目录。

```
package.json
electron.vite.config.ts
electron-builder.yml
vitest.config.ts
src/shared/ipc-result.ts          # IpcResult 与错误码
src/shared/models.ts              # 领域类型与默认设置
src/shared/ipc.ts                 # 通道名、Invoke/Event 表、window.api 形状
src/shared/routes.ts              # 侧栏路由表（渲染与命令面板共用）
src/shared/deep-link.ts           # 解析 electron-lab://
src/shared/external-url.ts        # https/mailto 白名单
src/main/index.ts
src/main/windows/main.ts
src/main/windows/child.ts
src/main/services/paths.ts        # userData 开发态后缀、子目录
src/main/services/path-jail.ts
src/main/services/logger.ts
src/main/services/conf.ts
src/main/services/db/migrations.ts
src/main/services/db/index.ts
src/main/services/crypto.ts       # safeStorage 适配
src/main/services/notes.ts
src/main/services/clipboard.ts
src/main/services/files.ts
src/main/services/downloads.ts
src/main/services/updater.ts
src/main/services/tray.ts
src/main/services/shortcuts.ts
src/main/services/protocol.ts
src/main/services/browser-session.ts
src/main/ipc/register.ts
src/main/ipc/app.ts
src/main/ipc/notes.ts
src/main/ipc/clipboard.ts
src/main/ipc/files.ts
src/main/ipc/system.ts
src/main/ipc/windows.ts
src/main/ipc/browser.ts
src/main/ipc/lab.ts
src/main/platforms/win.ts
src/main/platforms/mac.ts
src/main/utility/export-worker.ts
src/preload/index.ts
src/preload/index.d.ts
src/renderer/src/main.ts
src/renderer/src/App.vue
src/renderer/src/env.d.ts
src/renderer/src/layouts/AppLayout.vue
src/renderer/src/components/LabPage.vue
src/renderer/src/components/CommandPalette.vue
src/renderer/src/composables/useIpc.ts
src/renderer/src/stores/app.ts
src/renderer/src/router/index.ts
src/renderer/src/views/**         # 按路由一页一个
src/renderer/src/lab/catalog.ts
tests/path-jail.test.ts
tests/ipc-result.test.ts
tests/migrations.test.ts
tests/deep-link.test.ts
tests/external-url.test.ts
tests/notes.test.ts
tests/routes.test.ts
tests/updater-mock.test.ts
```

---

## P0 骨架

### Task 1: 官方脚手架与依赖

**Files:**

- Create: 仓库根目录除 `docs/` 与 `.git` 外的 electron-vite 工程文件
- Create: `vitest.config.ts`

- [ ] **Step 1: 在临时目录生成官方 vue-ts 模板并搬进仓库**

当前仓库已有 `docs/` 和 git，不要对非空根目录直接 `create`。执行：

```bash
cd /tmp
rm -rf electron-lab-scaffold
pnpm create @quick-start/electron@latest electron-lab-scaffold -- --template vue-ts
```

Expected: 生成 `/tmp/electron-lab-scaffold`，内含 `src/main`、`src/preload`、`src/renderer`、`electron.vite.config.ts`。

把脚手架文件拷进仓库根（保留 `docs/` 与 `.git`）：

```bash
rsync -a --exclude .git /tmp/electron-lab-scaffold/ /Users/julytian/Downloads/mianshi/electron-study/
cd /Users/julytian/Downloads/mianshi/electron-study
```

- [ ] **Step 2: 安装计划所需依赖**

```bash
pnpm add ant-design-vue pinia vue-router electron-conf electron-updater electron-log better-sqlite3
pnpm add -D vitest @types/better-sqlite3
```

`better-sqlite3` 必须在 `dependencies`，不要放进 `devDependencies`。

- [ ] **Step 3: 写 Vitest 配置**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
});
```

在 `package.json` 的 `scripts` 中加入：

```json
{
  "test": "vitest run",
  "typecheck:node": "tsc --noEmit -p tsconfig.node.json --composite false",
  "typecheck:web": "vue-tsc --noEmit -p tsconfig.web.json --composite false",
  "typecheck": "pnpm typecheck:node && pnpm typecheck:web"
}
```

- [ ] **Step 4: 确认开发能启动**

```bash
pnpm install
pnpm dev
```

Expected: Electron 窗口打开，官方欢迎页可见。然后关掉窗口。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: 初始化 electron-vite Vue3 工程与测试依赖

EOF
)"
```

---

### Task 2: 共享契约（类型与通道）

**Files:**

- Create: `src/shared/ipc-result.ts`
- Create: `src/shared/models.ts`
- Create: `src/shared/ipc.ts`
- Create: `src/shared/routes.ts`
- Create: `src/shared/deep-link.ts`
- Create: `src/shared/external-url.ts`
- Test: `tests/ipc-result.test.ts`
- Test: `tests/deep-link.test.ts`
- Test: `tests/external-url.test.ts`
- Test: `tests/routes.test.ts`

- [ ] **Step 1: 写失败测试**

Create `tests/ipc-result.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { errorCodes, ipcError, ipcOk } from '../src/shared/ipc-result';

describe('ipc-result', () => {
  it('wraps success payload', () => {
    expect(ipcOk(1)).toEqual({ ok: true, data: 1 });
  });

  it('wraps typed error', () => {
    expect(ipcError(errorCodes.PATH, 'escape')).toEqual({
      ok: false,
      error: { code: 'E_PATH', message: 'escape' },
    });
  });
});
```

Create `tests/deep-link.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseDeepLink } from '../src/shared/deep-link';

describe('parseDeepLink', () => {
  it('parses note id', () => {
    expect(parseDeepLink('electron-lab://note/12')).toEqual({
      kind: 'note',
      id: 12,
    });
  });

  it('rejects other protocols', () => {
    expect(parseDeepLink('https://example.com')).toBeNull();
  });

  it('rejects non-numeric note id', () => {
    expect(parseDeepLink('electron-lab://note/abc')).toBeNull();
  });
});
```

Create `tests/external-url.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isAllowedExternalUrl } from '../src/shared/external-url';

describe('isAllowedExternalUrl', () => {
  it('allows https and mailto', () => {
    expect(isAllowedExternalUrl('https://electron-vite.org')).toBe(true);
    expect(isAllowedExternalUrl('mailto:dev@example.com')).toBe(true);
  });

  it('rejects file and javascript', () => {
    expect(isAllowedExternalUrl('file:///etc/passwd')).toBe(false);
    expect(isAllowedExternalUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedExternalUrl('http://insecure.local')).toBe(false);
  });
});
```

Create `tests/routes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { routeGroups } from '../src/shared/routes';

describe('routeGroups', () => {
  it('has five sidebar groups', () => {
    expect(routeGroups.map((g) => g.key)).toEqual([
      'workbench',
      'windows',
      'browser',
      'lab',
      'settings',
    ]);
  });

  it('includes note and lab advanced routes', () => {
    const paths = routeGroups.flatMap((g) => g.items.map((i) => i.path));
    expect(paths).toContain('/workbench/notes');
    expect(paths).toContain('/lab/advanced');
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**

```bash
pnpm test
```

Expected: FAIL，模块找不到。

- [ ] **Step 3: 实现共享模块**

Create `src/shared/ipc-result.ts`:

```ts
export const errorCodes = {
  VALIDATION: 'E_VALIDATION',
  PATH: 'E_PATH',
  NOT_FOUND: 'E_NOT_FOUND',
  ENCRYPT: 'E_ENCRYPT',
  NETWORK: 'E_NETWORK',
  UPDATE: 'E_UPDATE',
  PLATFORM: 'E_PLATFORM',
} as const;

export type ErrorCode = (typeof errorCodes)[keyof typeof errorCodes];

export type IpcOk<T> = { ok: true; data: T };
export type IpcErr = { ok: false; error: { code: ErrorCode; message: string } };
export type IpcResult<T> = IpcOk<T> | IpcErr;

export function ipcOk<T>(data: T): IpcOk<T> {
  return { ok: true, data };
}

export function ipcError(code: ErrorCode, message: string): IpcErr {
  return { ok: false, error: { code, message } };
}
```

Create `src/shared/models.ts`:

```ts
export type ThemeMode = 'system' | 'light' | 'dark';
export type ClipboardKind = 'text' | 'html' | 'image';
export type DownloadState =
  | 'progressing'
  | 'completed'
  | 'cancelled'
  | 'interrupted'
  | 'paused';
export type UpdaterStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

export interface AppSettings {
  appearance: { theme: ThemeMode };
  window: { main: WindowState };
  behavior: { closeToTray: boolean; openAtLogin: boolean };
  shortcuts: { toggleWindow: string; clipboard: string; notes: string };
  updater: { autoCheck: boolean; autoDownload: boolean };
  protocol: { registered: boolean };
  ui: { lastRoute: string };
}

export const defaultSettings: AppSettings = {
  appearance: { theme: 'system' },
  window: { main: { width: 1200, height: 800, isMaximized: false } },
  behavior: { closeToTray: false, openAtLogin: false },
  shortcuts: {
    toggleWindow: 'CommandOrControl+Shift+L',
    clipboard: 'CommandOrControl+Shift+C',
    notes: 'CommandOrControl+Shift+N',
  },
  updater: { autoCheck: true, autoDownload: false },
  protocol: { registered: false },
  ui: { lastRoute: '/workbench/notes' },
};

export interface Note {
  id: number;
  title: string;
  body: string;
  isEncrypted: boolean;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ClipboardItem {
  id: number;
  kind: ClipboardKind;
  text: string | null;
  html: string | null;
  imagePath: string | null;
  createdAt: number;
}

export interface DownloadRecord {
  id: number;
  url: string;
  filename: string;
  savePath: string;
  state: DownloadState;
  received: number;
  total: number;
  createdAt: number;
  finishedAt: number | null;
}

export interface RecentFile {
  id: number;
  path: string;
  openedAt: number;
}

export interface LabEvent {
  id: number;
  module: string;
  action: string;
  ok: boolean;
  message: string;
  createdAt: number;
}

export interface AppInfo {
  name: string;
  version: string;
  electron: string;
  chrome: string;
  node: string;
  platform: NodeJS.Platform;
  arch: string;
  isPackaged: boolean;
  userData: string;
  dbReady: boolean;
  updaterStatus: UpdaterStatus;
}
```

Create `src/shared/deep-link.ts`:

```ts
export type DeepLink = { kind: 'note'; id: number };

export function parseDeepLink(url: string): DeepLink | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'electron-lab:') return null;
  const [, kind, rawId] = parsed.pathname.match(/^\/?(note)\/(\d+)$/) ?? [];
  if (kind !== 'note') return null;
  return { kind: 'note', id: Number(rawId) };
}
```

Create `src/shared/external-url.ts`:

```ts
export function isAllowedExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'mailto:';
  } catch {
    return false;
  }
}
```

Create `src/shared/routes.ts`:

```ts
export interface RouteItem {
  path: string;
  title: string;
}

export interface RouteGroup {
  key: 'workbench' | 'windows' | 'browser' | 'lab' | 'settings';
  title: string;
  items: RouteItem[];
}

export const routeGroups: RouteGroup[] = [
  {
    key: 'workbench',
    title: '工作台',
    items: [
      { path: '/workbench/clipboard', title: '剪贴板工作台' },
      { path: '/workbench/notes', title: '本地笔记' },
      { path: '/workbench/files', title: '文件与拖放' },
      { path: '/workbench/capture', title: '截图与桌面捕获' },
      { path: '/workbench/downloads', title: '下载中心' },
      { path: '/workbench/print', title: '打印与 PDF' },
      { path: '/workbench/system', title: '系统能力' },
    ],
  },
  {
    key: 'windows',
    title: '窗口中心',
    items: [
      { path: '/windows/lab', title: '窗口实验室' },
      { path: '/windows/chrome', title: '现代窗口外观' },
      { path: '/windows/ports', title: '跨窗口通信' },
    ],
  },
  {
    key: 'browser',
    title: '浏览',
    items: [{ path: '/browser', title: '迷你浏览器' }],
  },
  {
    key: 'lab',
    title: '实验室',
    items: [
      { path: '/lab/security', title: '进程与安全' },
      { path: '/lab/window', title: '窗口与视图' },
      { path: '/lab/desktop', title: '系统与桌面' },
      { path: '/lab/files', title: '文件与网络' },
      { path: '/lab/media', title: '媒体与捕获' },
      { path: '/lab/native-ui', title: '原生 UI' },
      { path: '/lab/protocol', title: '深链与文件关联' },
      { path: '/lab/network', title: '网络拦截与代理' },
      { path: '/lab/platform', title: '平台集成' },
      { path: '/lab/safe-storage', title: '安全存储' },
      { path: '/lab/metrics', title: '进程与性能' },
      { path: '/lab/advanced', title: '进阶' },
    ],
  },
  {
    key: 'settings',
    title: '设置',
    items: [
      { path: '/settings', title: '设置' },
      { path: '/about', title: '关于 / 诊断' },
    ],
  },
];
```

Create `src/shared/ipc.ts`:

```ts
import type { IpcResult } from './ipc-result'
import type {
  AppInfo,
  AppSettings,
  ClipboardItem,
  ClipboardKind,
  DownloadRecord,
  LabEvent,
  Note,
  ThemeMode,
  UpdaterStatus
} from './models'

export const invokeChannels = {
  'app:get-info': true,
  'conf:get': true,
  'conf:set': true,
  'db:status': true,
  'db:export': true,
  'db:clear': true,
  'shell:open-path': true,
  'shell:open-external': true,
  'shell:open-logs': true,
  'notes:list': true,
  'notes:get': true,
  'notes:create': true,
  'notes:update': true,
  'notes:delete': true,
  'clipboard:read': true,
  'clipboard:write': true,
  'clipboard:history': true,
  'clipboard:clear-history': true,
  'files:open': true,
  'files:save': true,
  'files:show-in-folder': true,
  'files:trash': true,
  'files:start-drag': true,
  'files:add-recent': true,
  'capture:sources': true,
  'capture:save': true,
  'downloads:list': true,
  'downloads:start': true,
  'downloads:pause': true,
  'downloads:resume': true,
  'downloads:cancel': true,
  'print:pdf': true,
  'system:notify': true,
  'system:get-power': true,
  'system:set-theme': true,
  'system:set-login': true,
  'window:create-child': true,
  'window:create-float': true,
  'window:set-progress': true,
  'window:set-fullscreen': true,
  'window:set-overlay': true,
  'port:create-pair': true,
  'port:send': true,
  'browser:create': true,
  'browser:navigate': true,
  'browser:go': true,
  'network:set-proxy': true,
  'network:set-filter': true,
  'protocol:register': true,
  'updater:check': true,
  'updater:download': true,
  'updater:install': true,
  'updater:mock': true,
  'metrics:get': true,
  'lab:run': true,
  'lab:events': true
} as const

export type InvokeChannel = keyof typeof invokeChannels

export interface InvokeMap {
  'app:get-info': { args: []; result: AppInfo }
  'conf:get': { args: []; result: AppSettings }
  'conf:set': { args: [patch: Partial<AppSettings>]; result: AppSettings }
  'db:status': { args: []; result: { ready: boolean; path: string } }
  'db:export': { args: []; result: { path: string } }
  'db:clear': { args: []; result: null }
  'shell:open-path': { args: [target: string]; result: null }
  'shell:open-external': { args: [url: string]; result: null }
  'shell:open-logs': { args: []; result: null }
  'notes:list': { args: [query?: string]; result: Note[] }
  'notes:get': { args: [id: number]; result: Note }
  'notes:create': {
    args: [input: { title: string; body: string; encrypted?: boolean }]
    result: Note
  }
  'notes:update': {
    args: [input: { id: number; title?: string; body?: string; pinned?: boolean; encrypted?: boolean }]
    result: Note
  }
  'notes:delete': { args: [id: number]; result: null }
  'clipboard:read': { args: []; result: { text: string; html: string; hasImage: boolean } }
  'clipboard:write': {
    args: [input: { kind: ClipboardKind; text?: string; html?: string }]
    result: ClipboardItem
  }
  'clipboard:history': { args: []; result: ClipboardItem[] }
  'clipboard:clear-history': { args: []; result: null }
  'files:open': { args: []; result: { path: string; content?: string } | null }
  'files:save': { args: [content: string]; result: { path: string } | null }
  'files:show-in-folder': { args: [target: string]; result: null }
  'files:trash': { args: [target: string]; result: null }
  'files:start-drag': { args: [target: string]; result: null }
  'files:add-recent': { args: [target: string]; result: null }
  'capture:sources': {
    args: []
    result: Array<{ id: string; name: string; thumbnailDataUrl: string }>
  }
  'capture:save': { args: [dataUrl: string]; result: { path: string } }
  'downloads:list': { args: []; result: DownloadRecord[] }
  'downloads:start': { args: [url: string]; result: DownloadRecord }
  'downloads:pause': { args: [id: number]; result: null }
  'downloads:resume': { args: [id: number]; result: null }
  'downloads:cancel': { args: [id: number]; result: null }
  'print:pdf': { args: []; result: { path: string } }
  'system:notify': { args: [input: { title: string; body: string; route?: string }]; result: null }
  'system:get-power': {
    args: []
    result: { onBattery: boolean; idleState: string }
  }
  'system:set-theme': { args: [theme: ThemeMode]; result: null }
  'system:set-login': { args: [enabled: boolean]; result: null }
  'window:create-child': { args: []; result: null }
  'window:create-float': { args: []; result: null }
  'window:set-progress': { args: [value: number]; result: null }
  'window:set-fullscreen': { args: [flag: boolean]; result: null }
  'window:set-overlay': { args: [enabled: boolean]; result: null }
  'port:create-pair': { args: []; result: null }
  'port:send': { args: [side: 'left' | 'right'; text: string]; result: null }
  'browser:create': { args: []; result: null }
  'browser:navigate': { args: [url: string]; result: null }
  'browser:go': { args: [action: 'back' | 'forward' | 'reload']; result: null }
  'network:set-proxy': { args: [rules: string]; result: null }
  'network:set-filter': { args: [enabled: boolean]; result: null }
  'protocol:register': { args: []; result: { ok: boolean } }
  'updater:check': { args: []; result: { status: UpdaterStatus; version?: string } }
  'updater:download': { args: []; result: null }
  'updater:install': { args: []; result: null }
  'updater:mock': { args: [status: UpdaterStatus]; result: null }
  'metrics:get': {
    args: []
    result: Array<{ pid: number; type: string; cpu: number; memory: number }>
  }
  'lab:run': { args: [module: string, action: string]; result: { message: string } }
  'lab:events': { args: []; result: LabEvent[] }
}

export const eventChannels = {
  'updater:progress': true,
  'updater:status': true,
  'download:updated': true,
  'deep-link:open': true,
  'theme:changed': true,
  'power:changed': true,
  'port:message': true,
  'browser:nav': true
} as const

export type EventChannel = keyof typeof eventChannels

export interface EventMap {
  'updater:progress': { percent: number }
  'updater:status': { status: UpdaterStatus; version?: string; message?: string }
  'download:updated': DownloadRecord
  'deep-link:open': { kind: 'note'; id: number }
  'theme:changed': { theme: ThemeMode }
  'power:changed': { onBattery: boolean }
  'port:message': { side: 'left' | 'right'; text: string }
  'browser:nav': { url: string; canBack: boolean; canForward: boolean }
}

export type InvokeFn = <C extends InvokeChannel>(
  channel: C,
  ...args: InvokeMap[C]['args']
) => Promise<IpcResult<InvokeMap[C]['result']>>

export type OnFn = <C extends EventChannel>(
  channel: C,
  listener: (payload: EventMap[C]) => void
) => () => void
```

- [ ] **Step 4: 跑测试，确认通过**

```bash
pnpm test
```

Expected: PASS，上述 4 个测试文件全绿。

- [ ] **Step 5: Commit**

```bash
git add src/shared tests
git commit -m "$(cat <<'EOF'
feat: 添加共享 IPC 契约与路由表

EOF
)"
```

---

### Task 3: 路径监禁与数据目录

**Files:**

- Create: `src/main/services/path-jail.ts`
- Create: `src/main/services/paths.ts`
- Test: `tests/path-jail.test.ts`

- [ ] **Step 1: 写失败测试**

Create `tests/path-jail.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertWithinRoot } from '../src/main/services/path-jail';

describe('assertWithinRoot', () => {
  const root = mkdtempSync(join(tmpdir(), 'elab-'));

  it('allows files inside root', () => {
    expect(assertWithinRoot(join(root, 'a.txt'), root)).toBe(
      join(root, 'a.txt'),
    );
  });

  it('rejects parent escape', () => {
    expect(() =>
      assertWithinRoot(join(root, '..', 'secret'), root),
    ).toThrowError(/E_PATH/);
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**

```bash
pnpm test tests/path-jail.test.ts
```

Expected: FAIL，`assertWithinRoot` 未定义。

- [ ] **Step 3: 实现**

Create `src/main/services/path-jail.ts`:

```ts
import path from 'node:path';

export function assertWithinRoot(target: string, root: string): string {
  const resolved = path.resolve(target);
  const normalizedRoot = path.resolve(root);
  const ok =
    resolved === normalizedRoot ||
    resolved.startsWith(normalizedRoot + path.sep);
  if (!ok) {
    const error = new Error('Path escapes root');
    error.name = 'E_PATH';
    throw error;
  }
  return resolved;
}
```

Create `src/main/services/paths.ts`:

```ts
import { app } from 'electron';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';

export function getAppUserData(): string {
  const base = app.getPath('userData');
  return app.isPackaged ? base : `${base}-dev`;
}

export function ensureAppDirs(): {
  userData: string;
  dbFile: string;
  clipboardDir: string;
  logsDir: string;
  exportsDir: string;
} {
  const userData = getAppUserData();
  const clipboardDir = join(userData, 'clipboard');
  const logsDir = join(userData, 'logs');
  const exportsDir = join(userData, 'exports');
  mkdirSync(clipboardDir, { recursive: true });
  mkdirSync(logsDir, { recursive: true });
  mkdirSync(exportsDir, { recursive: true });
  return {
    userData,
    dbFile: join(userData, 'app.db'),
    clipboardDir,
    logsDir,
    exportsDir,
  };
}
```

- [ ] **Step 4: 跑测试，确认通过**

```bash
pnpm test tests/path-jail.test.ts
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/main/services/path-jail.ts src/main/services/paths.ts tests/path-jail.test.ts
git commit -m "$(cat <<'EOF'
feat: 添加 userData 路径与路径监禁

EOF
)"
```

---

### Task 4: SQLite migration

**Files:**

- Create: `src/main/services/db/migrations.ts`
- Create: `src/main/services/db/index.ts`
- Test: `tests/migrations.test.ts`

- [ ] **Step 1: 写失败测试**

Create `tests/migrations.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../src/main/services/db/migrations';

describe('migrate', () => {
  it('creates tables and sets user_version to 1', () => {
    const db = new Database(':memory:');
    migrate(db);
    const version = db.pragma('user_version', { simple: true });
    expect(version).toBe(1);
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
      )
      .all() as Array<{ name: string }>;
    expect(tables.map((t) => t.name)).toEqual(
      expect.arrayContaining([
        'notes',
        'clipboard_items',
        'downloads',
        'recent_files',
        'lab_events',
      ]),
    );
    db.close();
  });

  it('is idempotent', () => {
    const db = new Database(':memory:');
    migrate(db);
    migrate(db);
    expect(db.pragma('user_version', { simple: true })).toBe(1);
    db.close();
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**

```bash
pnpm test tests/migrations.test.ts
```

Expected: FAIL，`migrate` 未定义。

- [ ] **Step 3: 实现 migration 与数据库打开**

Create `src/main/services/db/migrations.ts`:

```ts
import type Database from 'better-sqlite3';

const VERSION = 1;

const V1 = `
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT,
  body_cipher TEXT,
  is_encrypted INTEGER NOT NULL DEFAULT 0,
  pinned INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS clipboard_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  text TEXT,
  html TEXT,
  image_path TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS downloads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  filename TEXT NOT NULL,
  save_path TEXT NOT NULL,
  state TEXT NOT NULL,
  received INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  finished_at INTEGER
);
CREATE TABLE IF NOT EXISTS recent_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL,
  opened_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS lab_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  ok INTEGER NOT NULL,
  message TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
`;

export function migrate(db: Database.Database): void {
  const current = Number(db.pragma('user_version', { simple: true }));
  if (current >= VERSION) return;
  db.exec(V1);
  db.pragma(`user_version = ${VERSION}`);
}
```

Create `src/main/services/db/index.ts`:

```ts
import Database from 'better-sqlite3';
import { migrate } from './migrations';
import { ensureAppDirs } from '../paths';

let db: Database.Database | null = null;

export function openDatabase(): Database.Database {
  if (db) return db;
  const { dbFile } = ensureAppDirs();
  db = new Database(dbFile);
  db.pragma('journal_mode = WAL');
  migrate(db);
  return db;
}

export function getDatabase(): Database.Database {
  if (!db) throw new Error('Database not opened');
  return db;
}

export function closeDatabase(): void {
  db?.close();
  db = null;
}

export function clearBusinessTables(): void {
  const conn = getDatabase();
  conn.exec(
    'DELETE FROM notes; DELETE FROM clipboard_items; DELETE FROM downloads; DELETE FROM recent_files; DELETE FROM lab_events;',
  );
}
```

- [ ] **Step 4: 跑测试，确认通过**

```bash
pnpm test tests/migrations.test.ts
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/main/services/db tests/migrations.test.ts
git commit -m "$(cat <<'EOF'
feat: 添加 SQLite migration 与 WAL 连接

EOF
)"
```

---

### Task 5: 配置、日志、安全主窗口、单实例

**Files:**

- Create: `src/main/services/conf.ts`
- Create: `src/main/services/logger.ts`
- Create: `src/main/windows/main.ts`
- Modify: `src/main/index.ts`
- Modify: `electron-builder.yml`（asar unpack `better-sqlite3`）

- [ ] **Step 1: 实现 conf 与 logger**

Create `src/main/services/conf.ts`:

```ts
import { Conf } from 'electron-conf/main';
import { defaultSettings, type AppSettings } from '../../shared/models';
import { getAppUserData } from './paths';

let conf: Conf<AppSettings> | null = null;

export function getConf(): Conf<AppSettings> {
  if (!conf) {
    conf = new Conf<AppSettings>({
      dir: getAppUserData(),
      name: 'config',
      defaults: defaultSettings,
    });
  }
  return conf;
}

export function getSettings(): AppSettings {
  return getConf().store;
}

export function patchSettings(patch: Partial<AppSettings>): AppSettings {
  const current = getSettings();
  const next: AppSettings = {
    ...current,
    ...patch,
    appearance: { ...current.appearance, ...patch.appearance },
    window: { ...current.window, ...patch.window },
    behavior: { ...current.behavior, ...patch.behavior },
    shortcuts: { ...current.shortcuts, ...patch.shortcuts },
    updater: { ...current.updater, ...patch.updater },
    protocol: { ...current.protocol, ...patch.protocol },
    ui: { ...current.ui, ...patch.ui },
  };
  getConf().set(next);
  return next;
}
```

Create `src/main/services/logger.ts`:

```ts
import log from 'electron-log/main';
import { join } from 'node:path';
import { ensureAppDirs } from './paths';

export function setupLogger(): typeof log {
  const { logsDir } = ensureAppDirs();
  log.transports.file.resolvePathFn = () => join(logsDir, 'main.log');
  log.transports.file.maxSize = 1024 * 1024;
  log.initialize();
  return log;
}
```

- [ ] **Step 2: 实现安全主窗口**

Create `src/main/windows/main.ts`:

```ts
import { BrowserWindow, shell } from 'electron';
import { join } from 'node:path';
import { is } from '@electron-toolkit/utils';
import { getSettings, patchSettings } from '../services/conf';
import { isAllowedExternalUrl } from '../../shared/external-url';

let mainWindow: BrowserWindow | null = null;

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function createMainWindow(): BrowserWindow {
  const saved = getSettings().window.main;
  mainWindow = new BrowserWindow({
    width: saved.width,
    height: saved.height,
    x: saved.x,
    y: saved.y,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  if (saved.isMaximized) mainWindow.maximize();

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('close', () => {
    if (!mainWindow) return;
    const bounds = mainWindow.getBounds();
    patchSettings({
      window: {
        main: {
          ...bounds,
          isMaximized: mainWindow.isMaximized(),
        },
      },
    });
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const current = mainWindow?.webContents.getURL() ?? '';
    if (url !== current && !url.startsWith('http://localhost')) {
      event.preventDefault();
      if (isAllowedExternalUrl(url)) shell.openExternal(url);
    }
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return mainWindow;
}
```

Replace `src/main/index.ts` with:

```ts
import { app, BrowserWindow } from 'electron';
import { electronApp, optimizer } from '@electron-toolkit/utils';
import { setupLogger } from './services/logger';
import { ensureAppDirs } from './services/paths';
import { openDatabase, closeDatabase } from './services/db';
import { createMainWindow, getMainWindow } from './windows/main';
import { registerIpc } from './ipc/register';

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = getMainWindow();
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });
}

app.whenReady().then(() => {
  const log = setupLogger();
  process.on('uncaughtException', (error) => {
    log.error(error);
  });
  process.on('unhandledRejection', (reason) => {
    log.error(reason);
  });

  electronApp.setAppUserModelId('com.electronlab.app');
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  try {
    ensureAppDirs();
    openDatabase();
  } catch (error) {
    log.error(error);
    app.quit();
    return;
  }

  registerIpc();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  closeDatabase();
});
```

在 `electron-builder.yml` 增加（若文件是 JSON 则写到对应字段）：

```yaml
asarUnpack:
  - node_modules/better-sqlite3/**
appId: com.electronlab.app
productName: Electron Lab
```

- [ ] **Step 3: 手验窗口安全默认值**

```bash
pnpm dev
```

Expected: 窗口 `ready-to-show` 后出现；关窗再开位置恢复（P0 先能开即可）。开发者工具 Console 执行 `typeof require` 应为 `undefined`。

- [ ] **Step 4: Commit**

```bash
git add src/main electron-builder.yml
git commit -m "$(cat <<'EOF'
feat: 添加安全主窗口、单实例、conf 与日志

EOF
)"
```

---

### Task 6: typed IPC 注册与 preload

**Files:**

- Create: `src/main/ipc/app.ts`
- Create: `src/main/ipc/register.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`

- [ ] **Step 1: 实现 app IPC 与注册器**

Create `src/main/ipc/app.ts`:

```ts
import { app, dialog, ipcMain, shell } from 'electron';
import { copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { ipcError, ipcOk, errorCodes } from '../../shared/ipc-result';
import { isAllowedExternalUrl } from '../../shared/external-url';
import { getSettings, patchSettings } from '../services/conf';
import { clearBusinessTables, getDatabase } from '../services/db';
import { ensureAppDirs } from '../services/paths';
import { assertWithinRoot } from '../services/path-jail';
import type { AppInfo } from '../../shared/models';

export function registerAppIpc(): void {
  ipcMain.handle('app:get-info', () => {
    const { userData, dbFile } = ensureAppDirs();
    let dbReady = true;
    try {
      getDatabase();
    } catch {
      dbReady = false;
    }
    const data: AppInfo = {
      name: app.getName(),
      version: app.getVersion(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      platform: process.platform,
      arch: process.arch,
      isPackaged: app.isPackaged,
      userData,
      dbReady,
      updaterStatus: 'idle',
    };
    return ipcOk(data);
  });

  ipcMain.handle('conf:get', () => ipcOk(getSettings()));
  ipcMain.handle('conf:set', (_event, patch) => ipcOk(patchSettings(patch)));
  ipcMain.handle('db:status', () => {
    const { dbFile } = ensureAppDirs();
    try {
      getDatabase();
      return ipcOk({ ready: true, path: dbFile });
    } catch {
      return ipcOk({ ready: false, path: dbFile });
    }
  });

  ipcMain.handle('db:export', async () => {
    const { dbFile, exportsDir } = ensureAppDirs();
    const result = await dialog.showSaveDialog({
      defaultPath: join(exportsDir, 'app.db'),
    });
    if (result.canceled || !result.filePath) {
      return ipcError(errorCodes.VALIDATION, '已取消导出');
    }
    copyFileSync(dbFile, result.filePath);
    return ipcOk({ path: result.filePath });
  });

  ipcMain.handle('db:clear', () => {
    clearBusinessTables();
    return ipcOk(null);
  });

  ipcMain.handle('shell:open-path', (_event, target: string) => {
    const { userData } = ensureAppDirs();
    const safe = assertWithinRoot(target, userData);
    shell.openPath(safe);
    return ipcOk(null);
  });

  ipcMain.handle('shell:open-external', (_event, url: string) => {
    if (!isAllowedExternalUrl(url)) {
      return ipcError(errorCodes.VALIDATION, '不允许打开该协议');
    }
    shell.openExternal(url);
    return ipcOk(null);
  });

  ipcMain.handle('shell:open-logs', () => {
    const { logsDir } = ensureAppDirs();
    shell.openPath(logsDir);
    return ipcOk(null);
  });
}
```

Create `src/main/ipc/register.ts`:

```ts
import { registerAppIpc } from './app';

export function registerIpc(): void {
  registerAppIpc();
}
```

若 Task 5 的 `index.ts` 已调用 `registerIpc()`，保持即可。

- [ ] **Step 2: 实现 preload 白名单**

Replace `src/preload/index.ts`:

```ts
import { contextBridge, ipcRenderer } from 'electron';
import {
  eventChannels,
  invokeChannels,
  type EventChannel,
  type InvokeChannel,
} from '../shared/ipc';

const api = {
  invoke: (channel: string, ...args: unknown[]) => {
    if (!(channel in invokeChannels)) {
      return Promise.reject(new Error(`Blocked invoke: ${channel}`));
    }
    return ipcRenderer.invoke(channel as InvokeChannel, ...args);
  },
  on: (channel: string, listener: (payload: unknown) => void) => {
    if (!(channel in eventChannels)) {
      throw new Error(`Blocked event: ${channel}`);
    }
    const wrapped = (
      _event: Electron.IpcRendererEvent,
      payload: unknown,
    ): void => {
      listener(payload);
    };
    ipcRenderer.on(channel as EventChannel, wrapped);
    return () => ipcRenderer.removeListener(channel as EventChannel, wrapped);
  },
};

contextBridge.exposeInMainWorld('api', api);
```

Replace `src/preload/index.d.ts`:

```ts
import type { InvokeFn, OnFn } from '../shared/ipc';

declare global {
  interface Window {
    api: {
      invoke: InvokeFn;
      on: OnFn;
    };
  }
}

export {};
```

不要 `exposeInMainWorld('electron', electronAPI)`，不要暴露整个 `ipcRenderer`。

- [ ] **Step 3: 手验 preload**

```bash
pnpm dev
```

在渲染进程控制台：`window.api.invoke('app:get-info')` 应返回 `{ ok: true, data: { dbReady: true, ... } }`。
`window.api.invoke('not-a-channel')` 应失败。`window.electron` 应为 `undefined`。

- [ ] **Step 4: Commit**

```bash
git add src/main/ipc src/preload
git commit -m "$(cat <<'EOF'
feat: 注册 typed IPC 与 preload 白名单

EOF
)"
```

---

### Task 7: 渲染壳、路由占位、设置与关于

**Files:**

- Create: `src/renderer/src/composables/useIpc.ts`
- Create: `src/renderer/src/stores/app.ts`
- Create: `src/renderer/src/router/index.ts`
- Create: `src/renderer/src/layouts/AppLayout.vue`
- Create: `src/renderer/src/components/CommandPalette.vue`
- Create: `src/renderer/src/views/PlaceholderView.vue`
- Create: `src/renderer/src/views/SettingsView.vue`
- Create: `src/renderer/src/views/AboutView.vue`
- Modify: `src/renderer/src/main.ts`
- Modify: `src/renderer/src/App.vue`

- [ ] **Step 1: 入口与 IPC composable**

Create `src/renderer/src/composables/useIpc.ts`:

```ts
import { message } from 'ant-design-vue';
import type { InvokeChannel, InvokeMap } from '@shared/ipc';
import type { IpcResult } from '@shared/ipc-result';

export async function invokeIpc<C extends InvokeChannel>(
  channel: C,
  ...args: InvokeMap[C]['args']
): Promise<InvokeMap[C]['result']> {
  const result = (await window.api.invoke(channel, ...args)) as IpcResult<
    InvokeMap[C]['result']
  >;
  if (!result.ok) {
    message.error(result.error.message);
    throw Object.assign(new Error(result.error.message), {
      code: result.error.code,
    });
  }
  return result.data;
}
```

若 renderer 的 Vite alias 不是 `@shared`，在 `electron.vite.config.ts` 的 `renderer.resolve.alias` 增加：

```ts
import { resolve } from 'node:path'

renderer: {
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src'),
      '@shared': resolve('src/shared')
    }
  }
}
```

Create `src/renderer/src/stores/app.ts`:

```ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { AppInfo, AppSettings, UpdaterStatus } from '@shared/models';
import { defaultSettings } from '@shared/models';
import { invokeIpc } from '../composables/useIpc';

export const useAppStore = defineStore('app', () => {
  const info = ref<AppInfo | null>(null);
  const settings = ref<AppSettings>(defaultSettings);
  const updaterStatus = ref<UpdaterStatus>('idle');

  async function bootstrap(): Promise<void> {
    info.value = await invokeIpc('app:get-info');
    settings.value = await invokeIpc('conf:get');
    updaterStatus.value = info.value.updaterStatus;
  }

  async function saveSettings(patch: Partial<AppSettings>): Promise<void> {
    settings.value = await invokeIpc('conf:set', patch);
  }

  return { info, settings, updaterStatus, bootstrap, saveSettings };
});
```

Create `src/renderer/src/router/index.ts`:

```ts
import { createRouter, createWebHashHistory } from 'vue-router';
import { routeGroups } from '@shared/routes';
import AppLayout from '../layouts/AppLayout.vue';
import PlaceholderView from '../views/PlaceholderView.vue';
import SettingsView from '../views/SettingsView.vue';
import AboutView from '../views/AboutView.vue';

const children = routeGroups.flatMap((group) =>
  group.items.map((item) => {
    if (item.path === '/settings') {
      return { path: item.path, component: SettingsView };
    }
    if (item.path === '/about') {
      return { path: item.path, component: AboutView };
    }
    return { path: item.path, component: PlaceholderView };
  }),
);

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      component: AppLayout,
      redirect: '/workbench/notes',
      children,
    },
    { path: '/:pathMatch(.*)*', redirect: '/workbench/notes' },
  ],
});
```

Replace `src/renderer/src/main.ts`:

```ts
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import Antd from 'ant-design-vue';
import 'ant-design-vue/dist/reset.css';
import App from './App.vue';
import { router } from './router';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(Antd);
app.mount('#app');
```

Replace `src/renderer/src/App.vue`:

```vue
<script setup lang="ts">
import { onMounted } from 'vue';
import { useAppStore } from './stores/app';

const store = useAppStore();
onMounted(() => {
  void store.bootstrap();
});
</script>

<template>
  <RouterView />
</template>
```

- [ ] **Step 2: 布局、命令面板、占位页、设置、关于**

Create `src/renderer/src/views/PlaceholderView.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { routeGroups } from '@shared/routes';

const route = useRoute();
const title = computed(() => {
  for (const group of routeGroups) {
    const item = group.items.find((entry) => entry.path === route.path);
    if (item) return item.title;
  }
  return route.path;
});
</script>

<template>
  <a-result
    status="info"
    :title="title"
    sub-title="该模块将在后续分期接入，导航与路由已就绪。"
  >
  </a-result>
</template>
```

Create `src/renderer/src/components/CommandPalette.vue`:

```vue
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { routeGroups } from '@shared/routes';

const open = ref(false);
const keyword = ref('');
const router = useRouter();
const items = computed(() =>
  routeGroups
    .flatMap((group) =>
      group.items.map((item) => ({ ...item, group: group.title })),
    )
    .filter(
      (item) =>
        item.title.includes(keyword.value) || item.path.includes(keyword.value),
    ),
);

function onKey(event: KeyboardEvent): void {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    open.value = !open.value;
  }
}

onMounted(() => window.addEventListener('keydown', onKey));
onUnmounted(() => window.removeEventListener('keydown', onKey));

async function go(path: string): Promise<void> {
  open.value = false;
  await router.push(path);
}
</script>

<template>
  <a-modal v-model:open="open" title="跳转" :footer="null">
    <a-input v-model:value="keyword" placeholder="搜索模块" />
    <a-list :data-source="items" style="margin-top: 12px">
      <template #renderItem="{ item }">
        <a-list-item>
          <a-button type="link" @click="go(item.path)"
            >{{ item.group }} / {{ item.title }}</a-button
          >
        </a-list-item>
      </template>
    </a-list>
  </a-modal>
</template>
```

Create `src/renderer/src/layouts/AppLayout.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { theme } from 'ant-design-vue';
import { routeGroups } from '@shared/routes';
import { useAppStore } from '../stores/app';
import CommandPalette from '../components/CommandPalette.vue';

const route = useRoute();
const router = useRouter();
const store = useAppStore();
const selected = computed(() => [route.path]);
const isDark = computed(() => {
  const mode = store.settings.appearance.theme;
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
});

const algorithm = computed(() =>
  isDark.value ? theme.darkAlgorithm : theme.defaultAlgorithm,
);
</script>

<template>
  <a-config-provider :theme="{ algorithm }">
    <a-layout style="min-height: 100vh">
      <a-layout-sider width="240" breakpoint="lg" collapsible>
        <div style="padding: 16px; color: #fff; font-weight: 600">
          Electron Lab
        </div>
        <a-menu
          mode="inline"
          :selected-keys="selected"
          @click="({ key }) => router.push(String(key))"
        >
          <a-sub-menu
            v-for="group in routeGroups"
            :key="group.key"
            :title="group.title"
          >
            <a-menu-item v-for="item in group.items" :key="item.path">
              {{ item.title }}
            </a-menu-item>
          </a-sub-menu>
        </a-menu>
      </a-layout-sider>
      <a-layout>
        <a-layout-content style="padding: 16px">
          <RouterView />
        </a-layout-content>
        <a-layout-footer style="padding: 8px 16px">
          {{ store.info?.platform }} · Electron {{ store.info?.electron }} ·
          更新 {{ store.updaterStatus }} · DB
          {{ store.info?.dbReady ? '就绪' : '未就绪' }}
        </a-layout-footer>
      </a-layout>
    </a-layout>
    <CommandPalette />
  </a-config-provider>
</template>
```

Create `src/renderer/src/views/SettingsView.vue`:

```vue
<script setup lang="ts">
import { Modal } from 'ant-design-vue';
import { useAppStore } from '../stores/app';
import { invokeIpc } from '../composables/useIpc';

const store = useAppStore();

async function onTheme(theme: 'system' | 'light' | 'dark'): Promise<void> {
  await store.saveSettings({
    appearance: { ...store.settings.appearance, theme },
  });
}

async function onCloseToTray(checked: boolean): Promise<void> {
  await store.saveSettings({
    behavior: { ...store.settings.behavior, closeToTray: checked },
  });
}

async function exportDb(): Promise<void> {
  await invokeIpc('db:export');
}

async function clearDb(): Promise<void> {
  Modal.confirm({
    title: '清空业务数据？',
    content: '笔记、剪贴板历史、下载记录、实验室日志都会删除，设置保留。',
    async onOk() {
      await invokeIpc('db:clear');
    },
  });
}
</script>

<template>
  <a-space direction="vertical" size="large" style="width: 100%">
    <a-card title="通用">
      <a-form layout="vertical">
        <a-form-item label="主题">
          <a-select
            :value="store.settings.appearance.theme"
            :options="[
              { value: 'system', label: '跟随系统' },
              { value: 'light', label: '浅色' },
              { value: 'dark', label: '深色' },
            ]"
            style="width: 200px"
            @change="onTheme"
          />
        </a-form-item>
        <a-form-item label="关闭到托盘">
          <a-switch
            :checked="store.settings.behavior.closeToTray"
            @change="onCloseToTray"
          />
        </a-form-item>
      </a-form>
    </a-card>
    <a-card title="存储">
      <a-space>
        <a-button @click="exportDb">导出数据库</a-button>
        <a-button danger @click="clearDb">清空业务表</a-button>
      </a-space>
    </a-card>
  </a-space>
</template>
```

Create `src/renderer/src/views/AboutView.vue`:

```vue
<script setup lang="ts">
import { useAppStore } from '../stores/app';
import { invokeIpc } from '../composables/useIpc';

const store = useAppStore();

async function openLogs(): Promise<void> {
  await invokeIpc('shell:open-logs');
}
</script>

<template>
  <a-card title="关于 / 诊断">
    <a-descriptions bordered :column="1">
      <a-descriptions-item label="版本">{{
        store.info?.version
      }}</a-descriptions-item>
      <a-descriptions-item label="Electron">{{
        store.info?.electron
      }}</a-descriptions-item>
      <a-descriptions-item label="Chromium">{{
        store.info?.chrome
      }}</a-descriptions-item>
      <a-descriptions-item label="Node">{{
        store.info?.node
      }}</a-descriptions-item>
      <a-descriptions-item label="userData">{{
        store.info?.userData
      }}</a-descriptions-item>
      <a-descriptions-item label="更新">{{
        store.updaterStatus
      }}</a-descriptions-item>
    </a-descriptions>
    <a-button style="margin-top: 16px" @click="openLogs">打开日志目录</a-button>
  </a-card>
</template>
```

- [ ] **Step 3: 手验壳**

```bash
pnpm typecheck
pnpm test
pnpm dev
```

Expected: typecheck 通过；侧栏五组都能点到占位页；设置改主题后刷新仍在；关于页显示版本；`Cmd/Ctrl+K` 能跳转。

- [ ] **Step 4: Commit**

```bash
git add src/renderer electron.vite.config.ts
git commit -m "$(cat <<'EOF'
feat: 添加应用壳、路由占位、设置与关于页

EOF
)"
```

P0 完成标准：壳能开、设置能存、DB 能建、IPC 白名单可用。

---

## P1 核心工具

### Task 8: 笔记服务（含加密）

**Files:**

- Create: `src/main/services/crypto.ts`
- Create: `src/main/services/notes.ts`
- Create: `src/main/ipc/notes.ts`
- Modify: `src/main/ipc/register.ts`
- Test: `tests/notes.test.ts`

- [ ] **Step 1: 写失败测试**

Create `tests/notes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../src/main/services/db/migrations';
import {
  createNotesService,
  type SafeStorageLike,
} from '../src/main/services/notes';

function memoryDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  return db;
}

const stubCrypto: SafeStorageLike = {
  isEncryptionAvailable: () => true,
  encryptString: (plain) => Buffer.from(`enc:${plain}`),
  decryptString: (blob) => blob.toString().replace(/^enc:/, ''),
};

describe('notes service', () => {
  it('creates and lists plaintext notes', () => {
    const notes = createNotesService(memoryDb(), stubCrypto);
    notes.create({ title: 'a', body: 'hello' });
    expect(notes.list()[0]?.body).toBe('hello');
  });

  it('stores cipher and returns decrypted body', () => {
    const db = memoryDb();
    const notes = createNotesService(db, stubCrypto);
    const created = notes.create({
      title: 's',
      body: 'secret',
      encrypted: true,
    });
    const row = db
      .prepare('SELECT body, body_cipher FROM notes WHERE id = ?')
      .get(created.id) as {
      body: string | null;
      body_cipher: string | null;
    };
    expect(row.body).toBeNull();
    expect(row.body_cipher).toContain('enc:');
    expect(notes.get(created.id).body).toBe('secret');
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**

```bash
pnpm test tests/notes.test.ts
```

Expected: FAIL。

- [ ] **Step 3: 实现 crypto 与 notes**

Create `src/main/services/crypto.ts`:

```ts
import { safeStorage } from 'electron';
import type { SafeStorageLike } from './notes';

export function createSafeStorage(): SafeStorageLike {
  return {
    isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
    encryptString: (plain) => safeStorage.encryptString(plain),
    decryptString: (blob) => safeStorage.decryptString(blob),
  };
}
```

Create `src/main/services/notes.ts`:

```ts
import type Database from 'better-sqlite3';
import type { Note } from '../../shared/models';

export interface SafeStorageLike {
  isEncryptionAvailable(): boolean;
  encryptString(plain: string): Buffer;
  decryptString(blob: Buffer): string;
}

interface NoteRow {
  id: number;
  title: string;
  body: string | null;
  body_cipher: string | null;
  is_encrypted: number;
  pinned: number;
  created_at: number;
  updated_at: number;
}

export function createNotesService(
  db: Database.Database,
  crypto: SafeStorageLike,
) {
  function decode(row: NoteRow): Note {
    let body = row.body ?? '';
    if (row.is_encrypted) {
      if (!row.body_cipher)
        throw Object.assign(new Error('Missing cipher'), { name: 'E_ENCRYPT' });
      body = crypto.decryptString(Buffer.from(row.body_cipher, 'base64'));
    }
    return {
      id: row.id,
      title: row.title,
      body,
      isEncrypted: Boolean(row.is_encrypted),
      pinned: Boolean(row.pinned),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  return {
    list(query?: string): Note[] {
      const rows = query
        ? (db
            .prepare(
              'SELECT * FROM notes WHERE title LIKE ? OR ifnull(body, "") LIKE ? ORDER BY pinned DESC, updated_at DESC',
            )
            .all(`%${query}%`, `%${query}%`) as NoteRow[])
        : (db
            .prepare(
              'SELECT * FROM notes ORDER BY pinned DESC, updated_at DESC',
            )
            .all() as NoteRow[]);
      return rows.map((row) => {
        try {
          return decode(row);
        } catch {
          return {
            ...decode({ ...row, is_encrypted: 0, body: '', body_cipher: null }),
            body: '（无法解密）',
          };
        }
      });
    },
    get(id: number): Note {
      const row = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as
        | NoteRow
        | undefined;
      if (!row)
        throw Object.assign(new Error('Note not found'), {
          name: 'E_NOT_FOUND',
        });
      return decode(row);
    },
    create(input: { title: string; body: string; encrypted?: boolean }): Note {
      const now = Date.now();
      let body: string | null = input.body;
      let cipher: string | null = null;
      let encrypted = 0;
      if (input.encrypted) {
        if (!crypto.isEncryptionAvailable()) {
          throw Object.assign(new Error('Encryption unavailable'), {
            name: 'E_ENCRYPT',
          });
        }
        cipher = crypto.encryptString(input.body).toString('base64');
        body = null;
        encrypted = 1;
      }
      const result = db
        .prepare(
          'INSERT INTO notes (title, body, body_cipher, is_encrypted, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)',
        )
        .run(input.title, body, cipher, encrypted, now, now);
      return this.get(Number(result.lastInsertRowid));
    },
    update(input: {
      id: number;
      title?: string;
      body?: string;
      pinned?: boolean;
      encrypted?: boolean;
    }): Note {
      const current = this.get(input.id);
      const title = input.title ?? current.title;
      const nextBody = input.body ?? current.body;
      const pinned = input.pinned ?? current.pinned;
      const encrypted = input.encrypted ?? current.isEncrypted;
      let body: string | null = nextBody;
      let cipher: string | null = null;
      if (encrypted) {
        if (!crypto.isEncryptionAvailable()) {
          throw Object.assign(new Error('Encryption unavailable'), {
            name: 'E_ENCRYPT',
          });
        }
        cipher = crypto.encryptString(nextBody).toString('base64');
        body = null;
      }
      db.prepare(
        'UPDATE notes SET title=?, body=?, body_cipher=?, is_encrypted=?, pinned=?, updated_at=? WHERE id=?',
      ).run(
        title,
        body,
        cipher,
        encrypted ? 1 : 0,
        pinned ? 1 : 0,
        Date.now(),
        input.id,
      );
      return this.get(input.id);
    },
    delete(id: number): void {
      const result = db.prepare('DELETE FROM notes WHERE id = ?').run(id);
      if (result.changes === 0)
        throw Object.assign(new Error('Note not found'), {
          name: 'E_NOT_FOUND',
        });
    },
  };
}
```

Create `src/main/ipc/notes.ts`:

```ts
import { ipcMain } from 'electron';
import { errorCodes, ipcError, ipcOk } from '../../shared/ipc-result';
import { getDatabase } from '../services/db';
import { createSafeStorage } from '../services/crypto';
import { createNotesService } from '../services/notes';

function wrap(run: () => unknown) {
  try {
    return ipcOk(run());
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    const message = error instanceof Error ? error.message : 'Unknown';
    if (name === 'E_NOT_FOUND') return ipcError(errorCodes.NOT_FOUND, message);
    if (name === 'E_ENCRYPT') return ipcError(errorCodes.ENCRYPT, message);
    return ipcError(errorCodes.VALIDATION, message);
  }
}

export function registerNotesIpc(): void {
  const notes = () => createNotesService(getDatabase(), createSafeStorage());
  ipcMain.handle('notes:list', (_e, query?: string) =>
    wrap(() => notes().list(query)),
  );
  ipcMain.handle('notes:get', (_e, id: number) => wrap(() => notes().get(id)));
  ipcMain.handle('notes:create', (_e, input) =>
    wrap(() => notes().create(input)),
  );
  ipcMain.handle('notes:update', (_e, input) =>
    wrap(() => notes().update(input)),
  );
  ipcMain.handle('notes:delete', (_e, id: number) =>
    wrap(() => notes().delete(id)),
  );
}
```

Modify `src/main/ipc/register.ts`:

```ts
import { registerAppIpc } from './app';
import { registerNotesIpc } from './notes';

export function registerIpc(): void {
  registerAppIpc();
  registerNotesIpc();
}
```

- [ ] **Step 4: 跑测试，确认通过**

```bash
pnpm test tests/notes.test.ts
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/main/services/crypto.ts src/main/services/notes.ts src/main/ipc tests/notes.test.ts
git commit -m "$(cat <<'EOF'
feat: 添加笔记服务与加密存储

EOF
)"
```

---

### Task 9: 笔记页

**Files:**

- Create: `src/renderer/src/views/NotesView.vue`
- Create: `src/renderer/src/composables/useNotes.ts`
- Modify: `src/renderer/src/router/index.ts`

- [ ] **Step 1: 实现 composable 与页面**

Create `src/renderer/src/composables/useNotes.ts`:

```ts
import { onMounted, ref } from 'vue';
import type { Note } from '@shared/models';
import { invokeIpc } from './useIpc';

export function useNotes() {
  const notes = ref<Note[]>([]);
  const current = ref<Note | null>(null);
  const keyword = ref('');

  async function refresh(): Promise<void> {
    notes.value = await invokeIpc('notes:list', keyword.value || undefined);
  }

  async function open(id: number): Promise<void> {
    current.value = await invokeIpc('notes:get', id);
  }

  async function create(): Promise<void> {
    const note = await invokeIpc('notes:create', { title: '未命名', body: '' });
    await refresh();
    current.value = note;
  }

  async function save(): Promise<void> {
    if (!current.value) return;
    current.value = await invokeIpc('notes:update', {
      id: current.value.id,
      title: current.value.title,
      body: current.value.body,
      encrypted: current.value.isEncrypted,
      pinned: current.value.pinned,
    });
    await refresh();
  }

  async function remove(id: number): Promise<void> {
    await invokeIpc('notes:delete', id);
    if (current.value?.id === id) current.value = null;
    await refresh();
  }

  onMounted(() => {
    void refresh();
  });

  return { notes, current, keyword, refresh, open, create, save, remove };
}
```

Create `src/renderer/src/views/NotesView.vue`：左侧列表（置顶、搜索），右侧标题 / 正文 / 加密开关 / 保存。列表与编辑器拆在同一文件的两个 `a-col` 即可，逻辑全走 `useNotes`。

把 `src/renderer/src/router/index.ts` 里 `/workbench/notes` 从 `PlaceholderView` 换成 `NotesView`。

页面关键绑定：

```vue
<script setup lang="ts">
import { useNotes } from '../composables/useNotes';
const { notes, current, keyword, refresh, open, create, save, remove } =
  useNotes();
</script>
```

加密开关写在 `current.isEncrypted` 上，保存时传入 `notes:update`。

- [ ] **Step 2: 手验**

```bash
pnpm dev
```

Expected: 能新建、搜索、置顶、加密保存；重启后加密笔记仍能打开；用 SQLite 查看器打开 `userData-dev/app.db`，加密行的 `body` 为空且 `body_cipher` 非明文。

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/views/NotesView.vue src/renderer/src/composables/useNotes.ts src/renderer/src/router/index.ts
git commit -m "$(cat <<'EOF'
feat: 添加本地笔记页面

EOF
)"
```

---

### Task 10: 剪贴板工作台

**Files:**

- Create: `src/main/services/clipboard.ts`
- Create: `src/main/ipc/clipboard.ts`
- Create: `src/renderer/src/views/ClipboardView.vue`
- Modify: `src/main/ipc/register.ts`
- Modify: `src/renderer/src/router/index.ts`

- [ ] **Step 1: 实现主进程剪贴板**

`src/main/services/clipboard.ts` 使用 Electron `clipboard.readText()` / `readHTML()` / `readImage()`。写入历史表 `clipboard_items`。图片用 `nativeImage.toPNG()` 写到 `ensureAppDirs().clipboardDir`，`image_path` 必须 `assertWithinRoot(path, clipboardDir)`。HTML 存库，渲染展示时只用 `text` 或消毒后的纯文本，禁止直接 `v-html` 原始 HTML。

`src/main/ipc/clipboard.ts` 注册：

- `clipboard:read`
- `clipboard:write`
- `clipboard:history`
- `clipboard:clear-history`

`registerIpc` 增加 `registerClipboardIpc()`。

- [ ] **Step 2: 实现 ClipboardView**

列表显示历史；按钮：读取系统剪贴板、写入文本、清空历史。图片用 `file://` 不直接暴露任意路径，通过主进程保存后只展示文件名，预览用 `capture` 同类 dataUrl（若不便，P1 只显示「已保存图片」路径名）。

路由 `/workbench/clipboard` 指向该页。

- [ ] **Step 3: 手验后 Commit**

Expected: 复制一段文本，点读取能入库；写入后再到别的编辑器能粘贴。

```bash
git add src/main/services/clipboard.ts src/main/ipc/clipboard.ts src/renderer/src/views/ClipboardView.vue src/main/ipc/register.ts src/renderer/src/router/index.ts
git commit -m "$(cat <<'EOF'
feat: 添加剪贴板工作台

EOF
)"
```

---

### Task 11: 文件与拖放

**Files:**

- Create: `src/main/services/files.ts`
- Create: `src/main/ipc/files.ts`
- Create: `src/renderer/src/views/FilesView.vue`
- Modify: `src/main/ipc/register.ts`
- Modify: `src/renderer/src/router/index.ts`

- [ ] **Step 1: 主进程文件服务**

`files.ts`：

- `open`：`dialog.showOpenDialog`，读文本内容（限制 2 MB），写入 `recent_files`
- `save`：`dialog.showSaveDialog`
- `showInFolder`：`shell.showItemInFolder`
- `trash`：`shell.trashItem`
- `startDrag`：在 IPC 事件里对 `event.sender.startDrag({ file, icon })`，`file` 必须是用户刚打开或保存过的路径（维护内存 allowlist，拒绝任意字符串）
- `addRecent`：插入 `recent_files`

路径不在 allowlist 且不在 `userData` 内时返回 `E_PATH`。

- [ ] **Step 2: FilesView**

按钮：打开、保存、显示位置、移到回收站、拖出到桌面。沙箱下渲染进程不可信任意文件路径：拖入请用「打开」对话框；拖出走 `files:start-drag`，且只能拖 allowlist 内的文件。页面上写明这条限制，实验室「文件与网络」再解释原因。

- [ ] **Step 3: 手验后 Commit**

Expected: 打开 / 保存 / 显示位置 / 回收站可用；拖出能把允许名单内的文件拖到桌面。

```bash
git add src/main/services/files.ts src/main/ipc/files.ts src/renderer/src/views/FilesView.vue src/main/ipc/register.ts src/renderer/src/router/index.ts
git commit -m "$(cat <<'EOF'
feat: 添加文件对话框、最近文件与拖出

EOF
)"
```

P1 完成标准：笔记加密、剪贴板、文件三页可操作。

---

## P2 系统与窗口

### Task 12: 系统能力

**Files:**

- Create: `src/main/services/tray.ts`
- Create: `src/main/services/shortcuts.ts`
- Create: `src/main/ipc/system.ts`
- Create: `src/renderer/src/views/SystemView.vue`
- Modify: `src/main/index.ts`
- Modify: `src/main/windows/main.ts`
- Modify: `src/main/ipc/register.ts`
- Modify: `src/renderer/src/router/index.ts`

- [ ] **Step 1: 托盘、快捷键、通知、电源、主题、开机自启**

Create `src/main/services/tray.ts`：用 `Tray` + `Menu.buildFromTemplate`。菜单：打开主窗、跳到剪贴板、检查更新（调用 updater 服务，P5 未接前可 `console` 占位函数 `checkUpdates()` 从 `../services/updater` 延迟导入）、退出。点击托盘图标 `getMainWindow()?.show()`。

Create `src/main/services/shortcuts.ts`：按 `getSettings().shortcuts` 注册 `globalShortcut`。冲突时记日志并返回失败列表。`app.on('will-quit', () => globalShortcut.unregisterAll())`。

Create `src/main/ipc/system.ts`：

```ts
import {
  ipcMain,
  Notification,
  nativeTheme,
  powerMonitor,
  app,
} from 'electron';
import { ipcOk } from '../../shared/ipc-result';
import { patchSettings } from '../services/conf';
import { getMainWindow } from '../windows/main';

export function registerSystemIpc(): void {
  ipcMain.handle(
    'system:notify',
    (_e, input: { title: string; body: string; route?: string }) => {
      const notify = new Notification({ title: input.title, body: input.body });
      notify.on('click', () => {
        const win = getMainWindow();
        win?.show();
        if (input.route) {
          patchSettings({ ui: { lastRoute: input.route } });
        }
      });
      notify.show();
      return ipcOk(null);
    },
  );

  ipcMain.handle('system:get-power', () =>
    ipcOk({
      onBattery: powerMonitor.isOnBatteryPower(),
      idleState: powerMonitor.getSystemIdleState(60),
    }),
  );

  ipcMain.handle(
    'system:set-theme',
    (_e, theme: 'system' | 'light' | 'dark') => {
      nativeTheme.themeSource = theme;
      patchSettings({ appearance: { theme } });
      return ipcOk(null);
    },
  );

  ipcMain.handle('system:set-login', (_e, enabled: boolean) => {
    app.setLoginItemSettings({ openAtLogin: enabled });
    patchSettings({ behavior: { openAtLogin: enabled } });
    return ipcOk(null);
  });
}
```

通知点击若带笔记路由，应改成向渲染进程发一个已有事件。增加 `EventMap` 已有 `deep-link:open`；系统页演示通知用 `route` 时发送自定义不够。实现时：通知点击只 `show()` 主窗，并把 `input.route` 存到 `patchSettings({ ui: { lastRoute: input.route } })`，渲染 `bootstrap` 后 `router.push(settings.ui.lastRoute)`。

`createMainWindow` 的 `close`：若 `getSettings().behavior.closeToTray` 且非 macOS，`event.preventDefault()` + `hide()`。macOS 保持关窗隐藏不退出（`window-all-closed` 已处理）。

`index.ts` 在 `whenReady` 里调用 `createTray()`、`registerShortcuts()`，并 `registerSystemIpc()`。

- [ ] **Step 2: SystemView**

按钮：发通知、读电源、切换主题、开机自启开关。展示 `system:get-power` 返回值。当前平台没有开机自启 API 时显示 `E_PLATFORM` 文案。

路由 `/workbench/system` 指向该页。

- [ ] **Step 3: 手验后 Commit**

Expected: 托盘能唤起窗口；通知能弹出；主题切换立刻作用；快捷键能显示主窗。

```bash
git add src/main/services/tray.ts src/main/services/shortcuts.ts src/main/ipc/system.ts src/renderer/src/views/SystemView.vue src/main/index.ts src/main/windows/main.ts src/main/ipc/register.ts src/renderer/src/router/index.ts
git commit -m "$(cat <<'EOF'
feat: 添加托盘、通知、主题与开机自启

EOF
)"
```

---

### Task 13: 窗口实验室、现代外观、MessagePort

**Files:**

- Create: `src/main/windows/child.ts`
- Create: `src/main/ipc/windows.ts`
- Create: `src/renderer/src/views/WindowLabView.vue`
- Create: `src/renderer/src/views/WindowChromeView.vue`
- Create: `src/renderer/src/views/WindowPortsView.vue`
- Create: `src/renderer/src/views/PortChildView.vue`
- Modify: `src/main/ipc/register.ts`
- Modify: `src/renderer/src/router/index.ts`

- [ ] **Step 1: 子窗口与窗口 IPC**

Create `src/main/windows/child.ts`：

```ts
import { BrowserWindow } from 'electron';
import { join } from 'node:path';
import { is } from '@electron-toolkit/utils';

const children = new Set<BrowserWindow>();

function load(win: BrowserWindow, hash: string): void {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#${hash}`);
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash });
  }
}

export function createChildWindow(hash = '/windows/lab'): BrowserWindow {
  const win = new BrowserWindow({
    width: 640,
    height: 420,
    parent: undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  children.add(win);
  win.on('closed', () => children.delete(win));
  load(win, hash);
  return win;
}

export function createFloatWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 360,
    height: 240,
    alwaysOnTop: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  children.add(win);
  win.on('closed', () => children.delete(win));
  load(win, '/windows/lab');
  return win;
}

export function closeAllChildren(): void {
  for (const win of children) win.close();
  children.clear();
}
```

`window:set-progress` 调 `getMainWindow()?.setProgressBar(value)`，`value` 限制在 `0..1`，否则 `E_VALIDATION`。
`window:set-fullscreen` 调 `setFullScreen`。
`window:set-overlay`：`getMainWindow()?.setTitleBarOverlay({ color: '#1677ff', symbolColor: '#fff', height: 36 })`，不支持则 `E_PLATFORM`。

`port:create-pair`：创建两个 `BrowserWindow`，hash 分别为 `/ports/left` 与 `/ports/right`。用 `MessageChannelMain`，`left.webContents.postMessage('port', null, [port1])`，`right` 同理。渲染 `PortChildView` 用 `window.api` 不够接收 MessagePort——preload 增加：

```ts
window.addEventListener('message', (event) => {
  if (event.data !== 'port') return;
  const port = event.ports[0];
  port.onmessage = (msg) => {
    window.dispatchEvent(new CustomEvent('lab-port', { detail: msg.data }));
  };
  (window as unknown as { __labPort?: MessagePort }).__labPort = port;
});
```

`port:send` 不走 MessagePort 回主进程再转发；子窗页面自己 `port.postMessage`。`port:send` 仅作为备用：主进程 `webContents.send('port:message', { side, text })`。

路由增加 `/ports/left`、`/ports/right` → `PortChildView`（不进侧栏）。

主窗口关闭时 `closeAllChildren()`。

- [ ] **Step 2: 三个视图**

`WindowLabView`：创建子窗、悬浮窗、进度条滑块、全屏开关。
`WindowChromeView`：开关 titleBarOverlay，文案说明 Windows Mica / macOS 交通灯仅演示能力检测。
`WindowPortsView`：按钮「打开左右窗」；主页提示到子窗互发。`PortChildView` 一个输入框发送、一个列表接收。

- [ ] **Step 3: 手验后 Commit**

Expected: 能开子窗和悬浮窗；进度条在任务栏 / Dock 变化；左右窗能互发消息；父窗关闭子窗消失。

```bash
git add src/main/windows/child.ts src/main/ipc/windows.ts src/renderer/src/views/WindowLabView.vue src/renderer/src/views/WindowChromeView.vue src/renderer/src/views/WindowPortsView.vue src/renderer/src/views/PortChildView.vue src/preload/index.ts src/main/ipc/register.ts src/renderer/src/router/index.ts
git commit -m "$(cat <<'EOF'
feat: 添加多窗口、外观演示与 MessagePort

EOF
)"
```

P2 完成标准：系统能力页与三类窗口演示可操作。

---

## P3 浏览与网络

### Task 14: 迷你浏览器（WebContentsView）

**Files:**

- Create: `src/main/services/browser-session.ts`
- Create: `src/main/ipc/browser.ts`
- Create: `src/renderer/src/views/BrowserView.vue`
- Modify: `src/main/windows/main.ts`
- Modify: `src/main/ipc/register.ts`
- Modify: `src/renderer/src/router/index.ts`

- [ ] **Step 1: 独立 Session 与 WebContentsView**

```ts
import { session } from 'electron';

export function getBrowserSession() {
  const ses = session.fromPartition('persist:browser');
  ses.setPermissionRequestHandler((_wc, _perm, callback) => callback(false));
  return ses;
}
```

仅在进入 `/browser` 时由主进程创建 `WebContentsView`，`setBounds` 让出侧栏和地址栏高度。离开路由时 `mainWindow.contentView.removeChildView(view)`。导航只允许 `https:`，否则 `E_VALIDATION`。

`browser:navigate` / `browser:go` 操作该 view。导航事件向主窗 `webContents.send('browser:nav', { url, canBack, canForward })`。

主界面 session 与 `persist:browser` 隔离：实验室用手验 cookie。

- [ ] **Step 2: BrowserView 地址栏**

输入 URL、后退 / 前进 / 刷新。页面本身不渲染网页内容（内容在 WebContentsView）。

- [ ] **Step 3: 手验后 Commit**

Expected: 打开 https 站点；在迷你浏览器登录某站后，主窗口 `document.cookie` 不受影响。

```bash
git add src/main/services/browser-session.ts src/main/ipc/browser.ts src/renderer/src/views/BrowserView.vue src/main/windows/main.ts src/main/ipc/register.ts src/renderer/src/router/index.ts
git commit -m "$(cat <<'EOF'
feat: 添加 WebContentsView 迷你浏览器

EOF
)"
```

---

### Task 15: 下载、打印 PDF、截图

**Files:**

- Create: `src/main/services/downloads.ts`
- Create: `src/main/ipc/downloads.ts`
- Create: `src/renderer/src/views/DownloadsView.vue`
- Create: `src/renderer/src/views/PrintView.vue`
- Create: `src/renderer/src/views/CaptureView.vue`
- Modify: `src/main/ipc/register.ts`
- Modify: `src/renderer/src/router/index.ts`

- [ ] **Step 1: 下载服务**

在 `getBrowserSession()` 与默认 session 上监听 `will-download`。记录写入 `downloads` 表，进度 `webContents.send('download:updated', record)`。`downloads:start` 用 `session.defaultSession.downloadURL(url)`，URL 必须 `https:`。暂停 / 恢复 / 取消用内存 Map 保存 `DownloadItem` 引用。

- [ ] **Step 2: 打印与截图**

`print:pdf`：`getMainWindow()?.webContents.printToPDF({})` 写到 `exportsDir`。
`capture:sources`：`desktopCapturer.getSources({ types: ['screen', 'window'] })`，thumbnail 转 dataUrl。
`capture:save`：把 dataUrl 写到 `exportsDir`，路径监禁。

- [ ] **Step 3: 三个视图与手验**

DownloadsView：开始、暂停、恢复、取消、列表。
PrintView：导出当前页 PDF 并 `files:show-in-folder`。
CaptureView：列出源、保存一张。

Expected: 能下载一个 https 文件；能导出 PDF；能列出屏幕源并保存。

```bash
git add src/main/services/downloads.ts src/main/ipc/downloads.ts src/renderer/src/views/DownloadsView.vue src/renderer/src/views/PrintView.vue src/renderer/src/views/CaptureView.vue src/main/ipc/register.ts src/renderer/src/router/index.ts
git commit -m "$(cat <<'EOF'
feat: 添加下载中心、打印 PDF 与桌面捕获

EOF
)"
```

---

### Task 16: 网络拦截、代理、证书

**Files:**

- Modify: `src/main/services/browser-session.ts`
- Modify: `src/main/ipc/browser.ts`
- Create: `src/renderer/src/views/lab/NetworkLabView.vue`
- Modify: `src/renderer/src/router/index.ts`

- [ ] **Step 1: 只打在 persist:browser 上**

`network:set-filter` 为 true 时：

```ts
ses.webRequest.onBeforeRequest({ urls: ['https://*/*'] }, (details, cb) => {
  const blocked = details.url.includes('blocked.example');
  cb({ cancel: blocked });
});
```

`network:set-proxy`：`ses.setProxy({ proxyRules })`。
`ses.setCertificateVerifyProc((request, callback) => callback(0))` 仅在实验室开关打开且 `is.dev` 时放行自签证书，默认 `callback(-2)` 走系统校验。正式包不允许关闭校验。

- [ ] **Step 2: 实验室页**

说明 / 演示（过滤开关、代理输入）/ 要点 / 安全注意。演示作用在迷你浏览器，文案写「请先打开迷你浏览器」。

- [ ] **Step 3: Commit**

```bash
git add src/main/services/browser-session.ts src/main/ipc/browser.ts src/renderer/src/views/lab/NetworkLabView.vue src/renderer/src/router/index.ts
git commit -m "$(cat <<'EOF'
feat: 添加浏览器 Session 的拦截与代理演示

EOF
)"
```

P3 完成标准：迷你浏览器、下载、PDF、截图、网络实验室可操作。

---

## P4 系统集成

### Task 17: 深链与文件关联

**Files:**

- Create: `src/main/services/protocol.ts`
- Modify: `src/main/index.ts`
- Test: `tests/deep-link.test.ts`（已存在，保持绿）
- Modify: `src/renderer/src/main.ts`
- Create: `src/renderer/src/views/lab/ProtocolLabView.vue`

- [ ] **Step 1: 注册协议与二次实例**

```ts
const PROTOCOL = 'electron-lab';

export function registerProtocol(): boolean {
  if (process.defaultApp && process.argv.length >= 2) {
    return app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [
      resolve(process.argv[1]),
    ]);
  }
  return app.setAsDefaultProtocolClient(PROTOCOL);
}

export function extractUrlFromArgv(argv: string[]): string | null {
  return argv.find((arg) => arg.startsWith('electron-lab://')) ?? null;
}
```

`app.on('open-url')`（macOS）与 `second-instance` 的 `argv` 都 `parseDeepLink`，成功则 `getMainWindow()?.webContents.send('deep-link:open', payload)`。

渲染 `main.ts`：

```ts
window.api.on('deep-link:open', (payload) => {
  if (payload.kind === 'note')
    void router.push(`/workbench/notes?id=${payload.id}`);
});
```

`NotesView` 读取 `route.query.id` 调用 `open(Number(id))`。

`protocol:register` IPC 调用 `registerProtocol()` 并 `patchSettings({ protocol: { registered: true } })`。

- [ ] **Step 2: 实验室页与手验**

开发态说明：未安装包时用

```bash
# macOS 开发
open "electron-lab://note/1"
```

安装后再测文件关联：`electron-builder.yml` 增加 `fileAssociations: [{ ext: md, name: Markdown }]`。`app.on('open-file')` 读文件、写入 `recent_files`、打开笔记或 FilesView。

- [ ] **Step 3: Commit**

```bash
git add src/main/services/protocol.ts src/main/index.ts src/renderer/src/main.ts src/renderer/src/views/NotesView.vue src/renderer/src/views/lab/ProtocolLabView.vue electron-builder.yml
git commit -m "$(cat <<'EOF'
feat: 添加深链协议与文件关联

EOF
)"
```

---

### Task 18: 平台集成（Jump List / Dock / TouchBar）

**Files:**

- Create: `src/main/platforms/win.ts`
- Create: `src/main/platforms/mac.ts`
- Create: `src/renderer/src/views/lab/PlatformLabView.vue`
- Modify: `src/main/index.ts`

- [ ] **Step 1: 按平台实现**

`win.ts`：`app.setUserTasks` / `app.setJumpList`，项指向最近文件（只读 `recent_files` 仍存在的路径）。任务栏缩略图按钮：`getMainWindow()?.setThumbarButtons`，不支持则忽略。

`mac.ts`：`app.dock?.setMenu`；若 `TouchBar` 存在则 `mainWindow.setTouchBar`。用 `typeof TouchBar !== 'undefined'` 且运行时创建失败则记 `E_PLATFORM`，页面显示「当前设备无 TouchBar」。

`lab:run` 的 `platform` / `refresh-jump-list` 动作调用上述函数。

- [ ] **Step 2: 实验室页**

入口始终可见。按钮在 `process.platform` 不匹配时 disabled，文案说明原因。

- [ ] **Step 3: Commit**

```bash
git add src/main/platforms src/renderer/src/views/lab/PlatformLabView.vue src/main/index.ts src/main/ipc/lab.ts
git commit -m "$(cat <<'EOF'
feat: 添加 Jump List、Dock 与 TouchBar 集成

EOF
)"
```

P4 完成标准：深链能落到笔记；平台页按 OS 可用或禁用。

---

## P5 进阶

### Task 19: 更新（GitHub + mock）

**Files:**

- Create: `src/main/services/updater.ts`
- Create: `src/main/ipc/updater.ts`
- Test: `tests/updater-mock.test.ts`
- Modify: `src/renderer/src/views/AboutView.vue`
- Modify: `src/renderer/src/views/SettingsView.vue`
- Modify: `src/renderer/src/stores/app.ts`

- [ ] **Step 1: 写 mock 状态机测试**

```ts
import { describe, expect, it } from 'vitest';
import { createUpdaterMachine } from '../src/main/services/updater';

describe('updater machine', () => {
  it('walks mock states', () => {
    const machine = createUpdaterMachine({ packaged: false });
    expect(machine.status).toBe('idle');
    machine.mock('checking');
    machine.mock('available');
    machine.mock('downloading');
    machine.mock('downloaded');
    expect(machine.status).toBe('downloaded');
  });
});
```

- [ ] **Step 2: 跑测试确认失败，再实现**

`createUpdaterMachine`：开发态 `updater:check` / `download` / `install` 只改状态，不访问网络。`updater:mock` 供实验室点五态。

打包后：`autoUpdater.setFeedURL` 不手写，使用 `autoUpdater` 默认 GitHub provider（`electron-builder.yml` 的 `publish: { provider: github, owner: <填仓库主, repo: electron-study }`）。实现时 owner/repo 读 `package.json` 的 `repository` 字段，没有则保持 mock 并在关于页提示。

`app.isPackaged && settings.updater.autoCheck` 时，`whenReady` 后 `setTimeout(check, 10_000)`。进度 `autoUpdater.on('download-progress')` → `updater:progress`。`updater:install` 前若笔记页有未保存标记（渲染用 `confirm`），用户取消则不调用 `quitAndInstall`。

- [ ] **Step 3: UI 与测试通过后 Commit**

关于页：检查更新、下载、重启。设置页：`autoCheck` / `autoDownload`。底栏绑定 `store.updaterStatus`。实验室进阶页调用 `updater:mock`。

```bash
pnpm test tests/updater-mock.test.ts
git add src/main/services/updater.ts src/main/ipc/updater.ts tests/updater-mock.test.ts src/renderer/src/views/AboutView.vue src/renderer/src/views/SettingsView.vue src/renderer/src/stores/app.ts
git commit -m "$(cat <<'EOF'
feat: 添加 GitHub 增量更新与开发态 mock

EOF
)"
```

---

### Task 20: 性能、utilityProcess、崩溃、实验室目录

**Files:**

- Create: `src/main/utility/export-worker.ts`
- Create: `src/main/ipc/lab.ts`
- Create: `src/renderer/src/lab/catalog.ts`
- Create: `src/renderer/src/components/LabPage.vue`
- Create: `src/renderer/src/views/lab/LabHostView.vue`
- Create: `src/renderer/src/views/MetricsView.vue`
- Modify: `src/main/index.ts`（crashReporter）
- Modify: `src/renderer/src/router/index.ts`

- [ ] **Step 1: utilityProcess 与 metrics**

`export-worker.ts`：从 stdin 读 JSON，循环做字符串处理，stdout 写结果。主进程：

```ts
import { utilityProcess } from 'electron';
```

`lab:run('advanced', 'utility-export')` 启动 worker，完成后写入 `lab_events`。

`metrics:get`：`app.getAppMetrics()` 映射为 `{ pid, type, cpu, memory }`。

`crashReporter.start({ submitURL: '', uploadToServer: false, extra: { app: 'electron-lab' } })` 仅 `app.isPackaged`。实验室显示 `app.getPath('crashDumps')` 是否有文件。`lab:run('advanced', 'crash-main')` **不要**在正式包提供；仅 `is.dev` 抛错演示，按钮标注危险。

- [ ] **Step 2: 实验室目录驱动**

Create `src/renderer/src/lab/catalog.ts`，每个实验室路由一条：

```ts
export interface LabAction {
  id: string;
  title: string;
  danger?: boolean;
}

export interface LabModule {
  path: string;
  title: string;
  summary: string;
  tips: string;
  safety: string;
  actions: LabAction[];
}
```

至少包含 spec 里 12 个实验室 path。`LabPage.vue` 接收一个 `LabModule`，渲染四段 + 按钮，按钮调 `invokeIpc('lab:run', module, action)`。`LabHostView` 按 `route.path` 从 catalog 取值。

`lab:run` 在主进程用 `switch (module + action)` 调用已有服务（拿 app 信息、写 lab_events、mock 更新、刷新 Jump List 等），未知动作 `E_VALIDATION`。

路由所有 `/lab/*` 指向 `LabHostView`（`/lab/network` 若已有独立页可保留独立页，或并入 catalog）。

- [ ] **Step 3: 手验与收尾**

```bash
pnpm test
pnpm typecheck
pnpm dev
```

Expected: 实验室 12 页都能打开；进阶页能走更新 mock 与 utilityProcess；性能页能列出进程；`typeof require === 'undefined'` 仍成立。

```bash
git add src/main/utility src/main/ipc/lab.ts src/renderer/src/lab src/renderer/src/components/LabPage.vue src/renderer/src/views/lab src/renderer/src/views/MetricsView.vue src/main/index.ts src/renderer/src/router/index.ts
git commit -m "$(cat <<'EOF'
feat: 补齐实验室、性能面板与崩溃诊断

EOF
)"
```

P5 完成标准：更新五态、诊断、实验室目录闭环。Playwright e2e 不做。

---

## 每期统一手验

做完对应期后执行，不要留到最后：

1. 渲染进程 `typeof require === 'undefined'`。
2. 二次启动只聚焦已有窗口。
3. 笔记加密行在 `app.db` 无明文（P1+）。
4. 迷你浏览器 cookie 不影响主窗（P3+）。
5. 深链 `electron-lab://note/:id` 落到笔记（P4+）。
6. 开发态更新不打 GitHub（P5）。
7. 不支持的平台按钮禁用且有说明（P4+）。

---

## Self-review

**Spec 覆盖**

| Spec 章节                             | 任务         |
| ------------------------------------- | ------------ |
| 导航与五组侧栏                        | Task 2、7    |
| 安全窗口 / 单实例 / 日志              | Task 5       |
| typed IPC / preload 白名单            | Task 2、6    |
| conf + SQLite migration               | Task 3、4、7 |
| 笔记加密                              | Task 8、9    |
| 剪贴板 / 文件拖出                     | Task 10、11  |
| 系统能力                              | Task 12      |
| 窗口 / 外观 / MessagePort             | Task 13      |
| 迷你浏览器 / 下载 / PDF / 截图        | Task 14、15  |
| webRequest / 代理 / 证书              | Task 16      |
| 深链 / 文件关联                       | Task 17      |
| Jump List / Dock / TouchBar           | Task 18      |
| 更新 GitHub + mock                    | Task 19      |
| utilityProcess / 崩溃 / 实验室 / 性能 | Task 20      |
| 命令面板                              | Task 7       |
| 错误码与 IPC 形状                     | Task 2、6、8 |
| asarUnpack native                     | Task 5       |
| 不做 Playwright / 签名 / HID          | 已排除       |

**类型一致性：** 通道名、`IpcResult`、`AppSettings`、`Note`、`UpdaterStatus` 以 Task 2 为准，后续任务不得改名。

**协议：** 全程 `electron-lab://`，不以 `myapp://` 实现。
