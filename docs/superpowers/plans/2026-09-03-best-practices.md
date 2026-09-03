# 最佳实践 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补上 Session 安全、正式包 CSP / DevTools 快捷键、CI、公开仓库更新说明，以及「进程与安全」对照表。

**Architecture:** 可单测的纯函数放 `src/shared` 与无 Electron 运行时依赖的窗口/权限模块。`attachSessionSecurity` / `attachWindowSecurity` 只做挂载。实验室复用 `lab:run`，不新开 invoke 通道。

**Tech Stack:** 现有 Electron Lab（electron-vite、Vue 3、ant-design-vue、Vitest）。不新加 npm 包。不跑打包。

**Spec:** `docs/superpowers/specs/2026-09-03-best-practices-design.md`

---

## File map

```
src/shared/csp.ts
src/shared/electron-fuses.ts
src/shared/security-checklist.ts
src/shared/security-status.ts
src/main/services/session-permissions.ts
src/main/services/session-security.ts
src/main/services/browser-session.ts
src/main/windows/window-security.ts
src/main/windows/main.ts
src/main/windows/child.ts
src/main/index.ts
src/main/ipc/lab.ts
src/renderer/src/lab/catalog.ts
src/renderer/src/views/lab/LabHostView.vue
src/renderer/src/views/AboutView.vue
package.json
electron-builder.yml
.github/workflows/ci.yml
tests/csp.test.ts
tests/session-permissions.test.ts
tests/devtools-shortcut.test.ts
tests/electron-fuses.test.ts
tests/security-checklist.test.ts
tests/lab-catalog.test.ts
tests/updater-mock.test.ts
```

工作目录：仓库根 `/Users/julytian/Downloads/mianshi/electron-study`。提交用 HEREDOC，不要 `--no-verify`，不要 push（除非用户另说）。

新 BrowserWindow 必须 `sandbox: true`、`contextIsolation: true`、`nodeIntegration: false`。本期不新开窗口。不改 preload，不改 `invokeChannels`。`will-navigate` 仍留在 `attachRendererNavigation`。

---

### Task 1: CSP 常量

**Files:**

- Create: `src/shared/csp.ts`
- Test: `tests/csp.test.ts`

- [ ] **Step 1: 写失败测试**

Create `tests/csp.test.ts`:

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

```bash
pnpm exec vitest run tests/csp.test.ts
```

Expected: FAIL，找不到 `../src/shared/csp`。

- [ ] **Step 3: 最小实现**

Create `src/shared/csp.ts`:

```ts
export const CSP_HEADER =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:"

export function cspHeader(): string {
  return CSP_HEADER
}

export function shouldAttachCsp(kind: 'app' | 'browser', packaged: boolean): boolean {
  return kind === 'app' && packaged
}
```

不要改 `src/renderer/index.html`。

- [ ] **Step 4: 跑测试确认通过**

```bash
pnpm exec vitest run tests/csp.test.ts
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/shared/csp.ts tests/csp.test.ts
git commit -m "$(cat <<'EOF'
feat: 抽出与页面 meta 一致的 CSP 常量

EOF
)"
```

---

### Task 2: Session 权限按 kind 判断

**Files:**

- Modify: `src/main/services/session-permissions.ts`
- Test: `tests/session-permissions.test.ts`

- [ ] **Step 1: 写失败测试**

把 `tests/session-permissions.test.ts` 改成：

```ts
import { describe, expect, it } from 'vitest'
import {
  isDefaultSessionPermissionAllowed,
  isSessionPermissionAllowed
} from '../src/main/services/session-permissions'

describe('isDefaultSessionPermissionAllowed', () => {
  it('allows the workbench permissions the spec whitelist', () => {
    expect(isDefaultSessionPermissionAllowed('notifications')).toBe(true)
    expect(isDefaultSessionPermissionAllowed('clipboard-read')).toBe(true)
    expect(isDefaultSessionPermissionAllowed('clipboard-sanitized-write')).toBe(true)
    expect(isDefaultSessionPermissionAllowed('media')).toBe(true)
    expect(isDefaultSessionPermissionAllowed('display-capture')).toBe(true)
    expect(isDefaultSessionPermissionAllowed('fullscreen')).toBe(true)
  })

  it('denies everything else by default', () => {
    expect(isDefaultSessionPermissionAllowed('geolocation')).toBe(false)
    expect(isDefaultSessionPermissionAllowed('openExternal')).toBe(false)
    expect(isDefaultSessionPermissionAllowed('pointerLock')).toBe(false)
  })
})

describe('isSessionPermissionAllowed', () => {
  it('uses the app whitelist and denies all browser permissions', () => {
    expect(isSessionPermissionAllowed('app', 'notifications')).toBe(true)
    expect(isSessionPermissionAllowed('browser', 'notifications')).toBe(false)
    expect(isSessionPermissionAllowed('browser', 'media')).toBe(false)
    expect(isSessionPermissionAllowed('browser', 'geolocation')).toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm exec vitest run tests/session-permissions.test.ts
```

Expected: FAIL，`isSessionPermissionAllowed` 未导出。

- [ ] **Step 3: 最小实现**

把 `src/main/services/session-permissions.ts` 改成：

```ts
export type SessionSecurityKind = 'app' | 'browser'

const DEFAULT_SESSION_PERMISSIONS = new Set([
  'notifications',
  'clipboard-read',
  'clipboard-sanitized-write',
  'media',
  'display-capture',
  'fullscreen'
])

export function isSessionPermissionAllowed(kind: SessionSecurityKind, permission: string): boolean {
  if (kind === 'browser') return false
  return DEFAULT_SESSION_PERMISSIONS.has(permission)
}

export function isDefaultSessionPermissionAllowed(permission: string): boolean {
  return isSessionPermissionAllowed('app', permission)
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
pnpm exec vitest run tests/session-permissions.test.ts
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/main/services/session-permissions.ts tests/session-permissions.test.ts
git commit -m "$(cat <<'EOF'
feat: 按 Session 种类判断权限白名单

EOF
)"
```

---

### Task 3: DevTools 快捷键判断

**Files:**

- Create: `src/main/windows/window-security.ts`
- Test: `tests/devtools-shortcut.test.ts`

- [ ] **Step 1: 写失败测试**

Create `tests/devtools-shortcut.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isDevtoolsShortcut } from '../src/main/windows/window-security'

function input(partial: {
  key: string
  control?: boolean
  alt?: boolean
  shift?: boolean
  meta?: boolean
}): {
  key: string
  control: boolean
  alt: boolean
  shift: boolean
  meta: boolean
} {
  return {
    control: false,
    alt: false,
    shift: false,
    meta: false,
    ...partial
  }
}

describe('isDevtoolsShortcut', () => {
  it('matches the packaged DevTools combinations', () => {
    expect(isDevtoolsShortcut(input({ key: 'i', meta: true, alt: true }))).toBe(true)
    expect(isDevtoolsShortcut(input({ key: 'I', control: true, alt: true }))).toBe(true)
    expect(isDevtoolsShortcut(input({ key: 'i', meta: true, shift: true }))).toBe(true)
    expect(isDevtoolsShortcut(input({ key: 'i', control: true, shift: true }))).toBe(true)
    expect(isDevtoolsShortcut(input({ key: 'F12' }))).toBe(true)
    expect(isDevtoolsShortcut(input({ key: 'j', meta: true, alt: true }))).toBe(true)
    expect(isDevtoolsShortcut(input({ key: 'J', control: true, shift: true }))).toBe(true)
  })

  it('does not match ordinary typing, copy, or reload', () => {
    expect(isDevtoolsShortcut(input({ key: 'a' }))).toBe(false)
    expect(isDevtoolsShortcut(input({ key: 'c', control: true }))).toBe(false)
    expect(isDevtoolsShortcut(input({ key: 'r', control: true }))).toBe(false)
    expect(isDevtoolsShortcut(input({ key: 'r', meta: true }))).toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm exec vitest run tests/devtools-shortcut.test.ts
```

Expected: FAIL，找不到模块。

- [ ] **Step 3: 最小实现**

Create `src/main/windows/window-security.ts`:

```ts
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
```

本任务只要求 `isDevtoolsShortcut` 测试绿。`attachWindowSecurity` 先写上，Task 8 再接线。

- [ ] **Step 4: 跑测试确认通过**

```bash
pnpm exec vitest run tests/devtools-shortcut.test.ts
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/main/windows/window-security.ts tests/devtools-shortcut.test.ts
git commit -m "$(cat <<'EOF'
feat: 识别正式包应拦截的 DevTools 快捷键

EOF
)"
```

---

### Task 4: Fuses 声明、对照表、状态文案

**Files:**

- Create: `src/shared/electron-fuses.ts`
- Create: `src/shared/security-checklist.ts`
- Create: `src/shared/security-status.ts`
- Test: `tests/electron-fuses.test.ts`
- Test: `tests/security-checklist.test.ts`

- [ ] **Step 1: 写失败测试**

Create `tests/electron-fuses.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ELECTRON_FUSES } from '../src/shared/electron-fuses'

describe('ELECTRON_FUSES', () => {
  it('matches the electron-builder.yml electronFuses block', () => {
    const yml = readFileSync(resolve(__dirname, '../electron-builder.yml'), 'utf8')
    const block = yml.match(/electronFuses:\n((?:  .+\n)+)/)?.[1] ?? ''
    expect(block).toBeTruthy()
    const keys = Object.keys(ELECTRON_FUSES)
    expect(keys).toHaveLength(8)
    for (const [key, value] of Object.entries(ELECTRON_FUSES)) {
      expect(block).toContain(`${key}: ${value}`)
    }
  })
})
```

Create `tests/security-checklist.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { SECURITY_CHECKLIST } from '../src/shared/security-checklist'
import { formatSecurityStatus } from '../src/shared/security-status'

describe('SECURITY_CHECKLIST', () => {
  it('has eight rows with id title file and detail', () => {
    expect(SECURITY_CHECKLIST).toHaveLength(8)
    expect(SECURITY_CHECKLIST.map((row) => row.id)).toEqual([
      'sandbox',
      'context-isolation',
      'no-node',
      'permission-check',
      'navigation',
      'no-webview',
      'csp',
      'fuses'
    ])
    for (const row of SECURITY_CHECKLIST) {
      expect(row.title.length).toBeGreaterThan(0)
      expect(row.file.length).toBeGreaterThan(0)
      expect(row.detail.length).toBeGreaterThan(0)
    }
  })
})

describe('formatSecurityStatus', () => {
  it('joins packaged csp permissionCheck and fuse declarations', () => {
    const dev = formatSecurityStatus(false)
    expect(dev).toContain('packaged=false')
    expect(dev).toContain('cspSession=false')
    expect(dev).toContain('permissionCheck=true')
    expect(dev).toContain('fuses.runAsNode=false')
    expect(dev).toContain('fuses.enableCookieEncryption=true')

    const packaged = formatSecurityStatus(true)
    expect(packaged).toContain('packaged=true')
    expect(packaged).toContain('cspSession=true')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm exec vitest run tests/electron-fuses.test.ts tests/security-checklist.test.ts
```

Expected: FAIL，找不到 shared 模块。

- [ ] **Step 3: 最小实现**

Create `src/shared/electron-fuses.ts`:

```ts
export const ELECTRON_FUSES = {
  runAsNode: false,
  enableCookieEncryption: true,
  enableNodeOptionsEnvironmentVariable: false,
  enableNodeCliInspectArguments: false,
  enableEmbeddedAsarIntegrityValidation: true,
  onlyLoadAppFromAsar: true,
  loadBrowserProcessSpecificV8Snapshot: false,
  grantFileProtocolExtraPrivileges: false
} as const
```

Create `src/shared/security-checklist.ts`:

```ts
export interface SecurityChecklistRow {
  id: string
  title: string
  file: string
  detail: string
}

export const SECURITY_CHECKLIST: SecurityChecklistRow[] = [
  {
    id: 'sandbox',
    title: '窗口沙箱',
    file: 'src/main/windows/main.ts',
    detail: 'BrowserWindow 开启 sandbox，渲染进程不能直接碰 Node。'
  },
  {
    id: 'context-isolation',
    title: '上下文隔离',
    file: 'src/main/windows/main.ts',
    detail: 'contextIsolation 为 true，页面只能走 preload 白名单。'
  },
  {
    id: 'no-node',
    title: '渲染进程无 Node',
    file: 'src/main/windows/main.ts',
    detail: 'nodeIntegration 关闭，页面里没有 require。'
  },
  {
    id: 'permission-check',
    title: 'Session 权限检查',
    file: 'src/main/services/session-permissions.ts',
    detail: 'request 与 check 共用白名单；浏览器分区一律拒绝。'
  },
  {
    id: 'navigation',
    title: '导航与重定向',
    file: 'src/main/windows/navigation.ts',
    detail: 'will-navigate 与 will-redirect 共用同一套允许规则。'
  },
  {
    id: 'no-webview',
    title: '拒绝 webview',
    file: 'src/main/services/session-security.ts',
    detail: 'will-attach-webview 一律 preventDefault。'
  },
  {
    id: 'csp',
    title: 'CSP meta 与正式包响应头',
    file: 'src/renderer/index.html',
    detail: '开发态靠 meta；正式包再给 defaultSession 加同一条响应头。'
  },
  {
    id: 'fuses',
    title: 'Electron Fuses 声明',
    file: 'electron-builder.yml',
    detail: '打包时按声明关闭 runAsNode、只从 asar 加载等。'
  }
]
```

Create `src/shared/security-status.ts`:

```ts
import { ELECTRON_FUSES } from './electron-fuses'

export function formatSecurityStatus(packaged: boolean): string {
  const parts = [
    `packaged=${packaged}`,
    `cspSession=${packaged}`,
    'permissionCheck=true',
    ...Object.entries(ELECTRON_FUSES).map(([key, value]) => `fuses.${key}=${value}`)
  ]
  return parts.join('; ')
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
pnpm exec vitest run tests/electron-fuses.test.ts tests/security-checklist.test.ts
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/shared/electron-fuses.ts src/shared/security-checklist.ts src/shared/security-status.ts tests/electron-fuses.test.ts tests/security-checklist.test.ts
git commit -m "$(cat <<'EOF'
feat: 添加安全对照表与 Fuses 声明

EOF
)"
```

---

### Task 5: 实验室目录增加 security-status

**Files:**

- Modify: `src/renderer/src/lab/catalog.ts`
- Test: `tests/lab-catalog.test.ts`

- [ ] **Step 1: 扩展失败测试**

在 `tests/lab-catalog.test.ts` 现有 describe 里追加：

```ts
  it('lists app-info and security-status on the security module', () => {
    const security = labModules.find((module) => module.path === '/lab/security')
    expect(security?.actions.map((action) => action.id)).toEqual(['app-info', 'security-status'])
  })
```

12 条路由的断言不要删。

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm exec vitest run tests/lab-catalog.test.ts
```

Expected: FAIL，actions 只有 `app-info`。

- [ ] **Step 3: 最小实现**

把 `src/renderer/src/lab/catalog.ts` 里 `/lab/security` 的 `actions` 改成：

```ts
    actions: [
      { id: 'app-info', title: '查看应用与沙箱信息' },
      { id: 'security-status', title: '查看安全状态' }
    ]
```

只改这一处数组，summary / tips / safety 可以不动。

- [ ] **Step 4: 跑测试确认通过**

```bash
pnpm exec vitest run tests/lab-catalog.test.ts
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/lab/catalog.ts tests/lab-catalog.test.ts
git commit -m "$(cat <<'EOF'
feat: 安全实验室增加查看安全状态动作

EOF
)"
```

---

### Task 6: 仓库字段与 Linux maintainer

**Files:**

- Modify: `package.json`
- Modify: `electron-builder.yml`
- Modify: `tests/updater-mock.test.ts`

- [ ] **Step 1: 先改测试**

把 `tests/updater-mock.test.ts` 里这段：

```ts
  it('keeps mock when the app package.json has no repository', () => {
    expect(readPackageRepository(resolve(__dirname, '..'))).toBeNull();
  });
```

改成：

```ts
  it('reads the GitHub repository from the app package.json', () => {
    expect(readPackageRepository(resolve(__dirname, '..'))).toEqual({
      owner: 'julytian',
      repo: 'electron-study'
    })
  })
```

若该文件其余行仍用分号，新测试跟周围风格即可，不必全文件改风格。

再在 `parseGitHubRepository` 的 describe 里追加（已有 `acme` 用例则保留，另加一条）：

```ts
  it('parses the public electron-study repository URL', () => {
    expect(parseGitHubRepository('https://github.com/julytian/electron-study.git')).toEqual({
      owner: 'julytian',
      repo: 'electron-study'
    })
  })
```

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm exec vitest run tests/updater-mock.test.ts
```

Expected: FAIL，`readPackageRepository` 仍是 `null`。

- [ ] **Step 3: 改 package.json 与 yml**

在 `package.json` 的 `homepage` 后面增加（不要改 `author` / `homepage`）：

```json
  "repository": {
    "type": "git",
    "url": "https://github.com/julytian/electron-study.git"
  },
```

`electron-builder.yml` 这一行：

```yml
  maintainer: electronjs.org
```

改成：

```yml
  maintainer: julytian
```

不要动 `electronFuses` 块，否则 Task 4 的测试会红。

- [ ] **Step 4: 跑测试确认通过**

```bash
pnpm exec vitest run tests/updater-mock.test.ts tests/electron-fuses.test.ts
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add package.json electron-builder.yml tests/updater-mock.test.ts
git commit -m "$(cat <<'EOF'
feat: 填写公开仓库并修正 Linux maintainer

EOF
)"
```

---

### Task 7: 挂载 Session 安全

**Files:**

- Create: `src/main/services/session-security.ts`
- Modify: `src/main/index.ts`
- Modify: `src/main/services/browser-session.ts`

本任务无新的 Electron 窗口测试。纯函数已在 Task 1–2 覆盖。

- [ ] **Step 1: 实现 `attachSessionSecurity`**

Create `src/main/services/session-security.ts`:

```ts
import { app, shell, type Session } from 'electron'
import { isAllowedExternalUrl } from '../../shared/external-url'
import { cspHeader, shouldAttachCsp } from '../../shared/csp'
import {
  isSessionPermissionAllowed,
  type SessionSecurityKind
} from './session-permissions'
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

  if (shouldAttachCsp(kind, options.packaged)) {
    ses.webRequest.onHeadersReceived((details, callback) => {
      if (details.resourceType !== 'mainFrame' && details.resourceType !== 'subFrame') {
        callback({})
        return
      }
      const headers = { ...(details.responseHeaders ?? {}) }
      headers['Content-Security-Policy'] = [cspHeader()]
      callback({ responseHeaders: headers })
    })
  }

  ensureWebContentsHook()
}
```

若 `will-redirect` 在当前 Electron 类型里第二个参数不是 `string`，改用 `event.url` 或类型里给出的字段，规则不变。

- [ ] **Step 2: 接线 `index.ts`**

删掉：

```ts
import { isDefaultSessionPermissionAllowed } from './services/session-permissions'
```

以及 `whenReady` 里：

```ts
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(isDefaultSessionPermissionAllowed(permission))
  })
```

改成（`import { is } from '@electron-toolkit/utils'`，可与现有 `electronApp, optimizer` 合并）：

```ts
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { attachSessionSecurity } from './services/session-security'
```

在 `electronApp.setAppUserModelId('com.electronlab.app')` 之后：

```ts
  attachSessionSecurity(session.defaultSession, 'app', {
    packaged: app.isPackaged,
    isDev: is.dev
  })
```

`optimizer.watchWindowShortcuts` 保留。

- [ ] **Step 3: 接线浏览器 Session**

`src/main/services/browser-session.ts`：保留证书、过滤、代理。删掉自己写的 `setPermissionRequestHandler`。`fromPartition` 之后立刻：

```ts
import { app, session } from 'electron'
import { is } from '@electron-toolkit/utils'
import { attachSessionSecurity } from './session-security'
```

```ts
  const ses = session.fromPartition(BROWSER_PARTITION)
  attachSessionSecurity(ses, 'browser', {
    packaged: app.isPackaged,
    isDev: is.dev
  })
```

不要给浏览器分区加 CSP。不要改证书回调。

- [ ] **Step 4: typecheck**

```bash
pnpm typecheck
```

Expected: 通过。若 `Session` 类型要从 `electron` 换成本地 `Electron.Session`，按现有 `browser-session.ts` 风格改，不要改行为。

- [ ] **Step 5: Commit**

```bash
git add src/main/services/session-security.ts src/main/index.ts src/main/services/browser-session.ts
git commit -m "$(cat <<'EOF'
feat: 为 app 与浏览器 Session 挂载安全策略

EOF
)"
```

---

### Task 8: 窗口挂 DevTools 拦截

**Files:**

- Modify: `src/main/windows/main.ts`
- Modify: `src/main/windows/child.ts`

- [ ] **Step 1: 主窗**

`src/main/windows/main.ts` 增加：

```ts
import { app } from 'electron'
```

若已从 `electron` 导入 `BrowserWindow`，合并为：

```ts
import { app, BrowserWindow } from 'electron'
import { attachWindowSecurity } from './window-security'
```

在 `attachRendererNavigation(mainWindow)` 之后、`loadMainWindow` 之前：

```ts
  attachRendererNavigation(mainWindow)
  attachWindowSecurity(mainWindow, app.isPackaged)
  loadMainWindow(mainWindow, hash)
```

- [ ] **Step 2: 子窗与浮窗**

`src/main/windows/child.ts`：

```ts
import { app, BrowserWindow } from 'electron'
import { attachWindowSecurity } from './window-security'
```

`createChildWindow` 与 `createFloatWindow` 都在 `attachRendererNavigation(win)` 之后：

```ts
  attachRendererNavigation(win)
  attachWindowSecurity(win, app.isPackaged)
```

不要改 `webPreferences`。不要调用或 wrap `openDevTools`。不要新加「检查元素」菜单。

- [ ] **Step 3: typecheck**

```bash
pnpm typecheck
```

Expected: 通过。

- [ ] **Step 4: Commit**

```bash
git add src/main/windows/main.ts src/main/windows/child.ts
git commit -m "$(cat <<'EOF'
feat: 正式包窗口拦截 DevTools 快捷键

EOF
)"
```

---

### Task 9: 安全状态 IPC、对照表、关于页

**Files:**

- Modify: `src/main/ipc/lab.ts`
- Modify: `src/renderer/src/views/lab/LabHostView.vue`
- Modify: `src/renderer/src/views/AboutView.vue`

- [ ] **Step 1: `lab:run` 实现 security-status**

`src/main/ipc/lab.ts` 增加：

```ts
import { formatSecurityStatus } from '../../shared/security-status'
```

把原来的：

```ts
  if (module === 'security' && action === 'app-info') {
    return ipcOk({
      message: `name=${app.getName()} version=${app.getVersion()} packaged=${app.isPackaged} sandbox=渲染进程无 Node`
    })
  }
```

换成：

```ts
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
```

不要新通道。未知动作仍落到文件末尾的 `E_VALIDATION`。

- [ ] **Step 2: 对照表 UI**

把 `src/renderer/src/views/lab/LabHostView.vue` 改成：

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { SECURITY_CHECKLIST } from '@shared/security-checklist'
import LabPage from '../../components/LabPage.vue'
import { labModules } from '../../lab/catalog'

const columns = [
  { title: '条目', dataIndex: 'title', key: 'title' },
  { title: '文件', dataIndex: 'file', key: 'file' },
  { title: '说明', dataIndex: 'detail', key: 'detail' }
]

const route = useRoute()
const current = computed(() => labModules.find((module) => module.path === route.path))
const showChecklist = computed(() => current.value?.path === '/lab/security')
</script>

<template>
  <a-space v-if="current" direction="vertical" class="lab-host" :size="16">
    <a-card v-if="showChecklist" title="对照表">
      <a-table
        :columns="columns"
        :data-source="SECURITY_CHECKLIST"
        :pagination="false"
        row-key="id"
        size="small"
      />
    </a-card>
    <LabPage :module="current" />
  </a-space>
  <a-result v-else status="info" title="未找到该实验室" sub-title="目录中没有对应模块。" />
</template>

<style scoped>
.lab-host {
  width: 100%;
}
</style>
```

无 `v-html`。不新开路由。

- [ ] **Step 3: 关于页签名说明**

在 `AboutView.vue` 的 `a-descriptions` 后面、更新错误 alert 前面插入：

```vue
    <a-alert
      style="margin-top: 16px"
      type="info"
      show-icon
      message="发布与签名"
      description="macOS 公证和 Windows 签名需要证书。本仓库 electron-builder 的 notarize 为 false，没有证书就不做签名或公证。"
    />
```

`showMockHint` 逻辑不要改：正式包且 `hasRepository` 时本来就不显示 mock 提示。

- [ ] **Step 4: typecheck**

```bash
pnpm typecheck
```

Expected: 通过。

- [ ] **Step 5: Commit**

```bash
git add src/main/ipc/lab.ts src/renderer/src/views/lab/LabHostView.vue src/renderer/src/views/AboutView.vue
git commit -m "$(cat <<'EOF'
feat: 展示安全对照表与发布签名说明

EOF
)"
```

---

### Task 10: GitHub Actions CI

**Files:**

- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: 写 workflow**

Create `.github/workflows/ci.yml`:

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
      - run: pnpm test
      - run: pnpm typecheck
      - run: pnpm lint
```

不要加 `electron-builder` / `pnpm build`。

- [ ] **Step 2: 本地确认文件存在**

```bash
test -f .github/workflows/ci.yml && rg -n "pnpm test|pnpm typecheck|pnpm lint" .github/workflows/ci.yml
```

Expected: 文件存在，三行命令都在。

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "$(cat <<'EOF'
ci: 添加 test typecheck lint 工作流

EOF
)"
```

---

### Task 11: 全量验证

- [ ] **Step 1:**

```bash
pnpm test
pnpm typecheck
pnpm lint
```

Expected: 全部绿。

- [ ] **Step 2: 手验清单（写进报告，不阻塞 commit）**

1. 开发态：DevTools 快捷键仍可用；关于页仍提示 mock（未打包）。
2. 「进程与安全」：表有 8 行；「查看安全状态」能看到 packaged / cspSession / permissionCheck / fuses。
3. `.github/workflows/ci.yml` 含 test、typecheck、lint。

- [ ] **Step 3:** 若 Step 1 已绿且无未提交，本任务无新 commit。有漏网则：

```bash
git add -u
git commit -m "$(cat <<'EOF'
fix: 收口最佳实践期的类型与测试

EOF
)"
```

不要 `git push`。

---

## Spec 覆盖

| 规格 | 任务 |
| --- | --- |
| `cspHeader` 与 meta 一致；仅正式包 app Session 加头 | Task 1、7 |
| `isSessionPermissionAllowed` app 白名单 / browser 全拒 | Task 2、7 |
| `will-attach-webview` 拒绝 | Task 7 |
| app `will-redirect` 复用 `isRendererNavigationAllowed` | Task 7 |
| 浏览器分区不拦第三方 redirect、不加 CSP | Task 7 |
| `isDevtoolsShortcut` 与正式包 `before-input-event` | Task 3、8 |
| 不禁用 `openDevTools`、不加检查菜单 | Task 8 |
| `repository` + maintainer；更新逻辑不改 | Task 6 |
| 关于页签名说明；mock 提示条件不改 | Task 9 |
| CI test / typecheck / lint，不打包 | Task 10 |
| 对照表 8 行；`security-status` 文案 | Task 4、5、9 |
| 不新开 invoke 通道 | 全程 |
| 全量验证 | Task 11 |
