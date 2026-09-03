# 公开仓库上架 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Electron Lab 做成公开仓库能给人 clone、构建、看懂边界：身份、LICENSE、README、正式包菜单、关于页开仓库。

**Architecture:** 菜单过滤是无 Electron 依赖的纯函数；`applyApplicationMenu` 只在正式包 `setApplicationMenu`。身份与文档是静态文件。不新开 IPC。

**Tech Stack:** 现有 Electron Lab。不新加 npm 包。不跑打包。

**Spec:** `docs/superpowers/specs/2026-09-03-public-launch-design.md`

---

## File map

```
src/main/windows/app-menu.ts
src/main/index.ts
src/renderer/index.html
src/renderer/src/views/AboutView.vue
package.json
LICENSE
README.md
tests/app-menu.test.ts
```

工作目录：`/Users/julytian/Downloads/mianshi/electron-study/.worktrees/best-practices`（分支 `feat/best-practices`）。不要改父仓库 `master` 工作区。提交用 HEREDOC，不要 `--no-verify`。Task 1–6 不要 push。Task 7 落地时再 push 开 PR。

新 BrowserWindow 必须 `sandbox: true`、`contextIsolation: true`、`nodeIntegration: false`。本期不新开窗口。不改 preload，不改 `invokeChannels`。

---

### Task 1: 菜单过滤纯函数

**Files:**

- Create: `src/main/windows/app-menu.ts`
- Test: `tests/app-menu.test.ts`

- [ ] **Step 1: 写失败测试**

Create `tests/app-menu.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  isDevtoolsMenuRole,
  withoutDevtoolsMenuItems,
  type MenuItemLike
} from '../src/main/windows/app-menu'

describe('isDevtoolsMenuRole', () => {
  it('matches toggleDevTools case-insensitively', () => {
    expect(isDevtoolsMenuRole('toggleDevTools')).toBe(true)
    expect(isDevtoolsMenuRole('toggledevtools')).toBe(true)
    expect(isDevtoolsMenuRole('reload')).toBe(false)
    expect(isDevtoolsMenuRole('quit')).toBe(false)
    expect(isDevtoolsMenuRole(undefined)).toBe(false)
  })
})

describe('withoutDevtoolsMenuItems', () => {
  it('strips nested toggleDevTools and inspect labels, keeps reload', () => {
    const input: MenuItemLike[] = [
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'toggleDevTools' },
          { label: '检查元素' },
          { label: 'Toggle Developer Tools' }
        ]
      },
      {
        label: 'EmptyDev',
        submenu: [{ role: 'toggledevtools' }]
      }
    ]
    expect(withoutDevtoolsMenuItems(input)).toEqual([
      {
        label: 'View',
        submenu: [{ role: 'reload' }]
      }
    ])
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm exec vitest run tests/app-menu.test.ts
```

Expected: FAIL，找不到模块。

- [ ] **Step 3: 最小实现**

Create `src/main/windows/app-menu.ts`。**不要** `import` electron 的值（`import type` 也不必要）。

```ts
export interface MenuItemLike {
  role?: string
  label?: string
  submenu?: MenuItemLike[]
}

export function isDevtoolsMenuRole(role: string | undefined): boolean {
  return role?.toLowerCase() === 'toggledevtools'
}

function isDevtoolsMenuLabel(label: string | undefined): boolean {
  if (!label) return false
  return label.includes('Toggle Developer Tools') || label.includes('检查元素')
}

export function withoutDevtoolsMenuItems(items: MenuItemLike[]): MenuItemLike[] {
  const next: MenuItemLike[] = []
  for (const item of items) {
    if (isDevtoolsMenuRole(item.role) || isDevtoolsMenuLabel(item.label)) continue
    if (item.submenu) {
      const submenu = withoutDevtoolsMenuItems(item.submenu)
      if (submenu.length === 0) continue
      next.push({ ...item, submenu })
      continue
    }
    next.push(item)
  }
  return next
}

export function buildPackagedMenuTemplate(): MenuItemLike[] {
  const edit: MenuItemLike = {
    label: '编辑',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' }
    ]
  }
  const windowMenu: MenuItemLike = {
    label: '窗口',
    submenu: [{ role: 'minimize' }, { role: 'close' }]
  }
  const help: MenuItemLike = {
    label: '帮助',
    submenu: [{ label: '打开仓库' }]
  }
  if (process.platform === 'darwin') {
    return [
      {
        label: 'Electron Lab',
        submenu: [{ role: 'about' }, { role: 'hide' }, { role: 'quit' }]
      },
      edit,
      windowMenu,
      help
    ]
  }
  return [edit, windowMenu, help]
}
```

本任务不接线 `setApplicationMenu`。

- [ ] **Step 4: 跑测试确认通过**

```bash
pnpm exec vitest run tests/app-menu.test.ts
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/main/windows/app-menu.ts tests/app-menu.test.ts
git commit -m "$(cat <<'EOF'
feat: 添加正式包菜单的 DevTools 过滤

EOF
)"
```

---

### Task 2: 正式包挂应用菜单

**Files:**

- Modify: `src/main/index.ts`

- [ ] **Step 1: 在 `index.ts` 增加 `applyApplicationMenu`**

在文件顶部 electron 导入里加上 `Menu`、`shell`（与现有 `app, BrowserWindow, ...` 合并）：

```ts
import { app, BrowserWindow, crashReporter, Menu, session, shell } from 'electron'
import { buildPackagedMenuTemplate } from './windows/app-menu'
```

在 `attachSessionSecurity(...)` 之后、`browser-window-created` 之前插入：

```ts
function applyApplicationMenu(packaged: boolean): void {
  if (!packaged) return
  const template = buildPackagedMenuTemplate().map((item) => {
    if (item.label !== '帮助' || !item.submenu) return item
    return {
      ...item,
      submenu: item.submenu.map((entry) =>
        entry.label === '打开仓库'
          ? {
              ...entry,
              click: () => {
                void shell.openExternal('https://github.com/julytian/electron-study')
              }
            }
          : entry
      )
    }
  })
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

  applyApplicationMenu(app.isPackaged)
```

`applyApplicationMenu(app.isPackaged)` 必须放在 `whenReady` 回调里、`createMainWindow` 之前。开发态 `packaged === false` 直接 return，不 `setApplicationMenu`。

不要 wrap `openDevTools`。不要改 `webPreferences`。

若 TypeScript 抱怨 `buildFromTemplate` 的类型，把 template 断言为 `Electron.MenuItemConstructorOptions[]`，不要改行为。

- [ ] **Step 2: typecheck**

```bash
pnpm typecheck
```

Expected: 通过。

- [ ] **Step 3: Commit**

```bash
git add src/main/index.ts
git commit -m "$(cat <<'EOF'
feat: 正式包使用不含检查项的应用菜单

EOF
)"
```

---

### Task 3: 身份字段、标题、LICENSE

**Files:**

- Modify: `package.json`
- Modify: `src/renderer/index.html`
- Create: `LICENSE`

- [ ] **Step 1: 改 `package.json`**

只改这三个字段（`repository` 不动）：

```json
  "description": "日常桌面工具与 Electron API 实验室",
  "author": "julytian",
  "homepage": "https://github.com/julytian/electron-study",
```

- [ ] **Step 2: 改标题**

`src/renderer/index.html` 把 `<title>Electron</title>` 改成 `<title>Electron Lab</title>`。不要改 CSP meta。

- [ ] **Step 3: 写 LICENSE**

Create `LICENSE`（MIT 全文）：

```
MIT License

Copyright (c) 2026 julytian

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 4: Commit**

```bash
git add package.json src/renderer/index.html LICENSE
git commit -m "$(cat <<'EOF'
docs: 填写项目身份并添加 MIT 许可证

EOF
)"
```

---

### Task 4: README

**Files:**

- Modify: `README.md`

- [ ] **Step 1: 整文件替换**

把 `README.md` 换成下面全文，不要保留 electron-lab-scaffold / Recommended IDE Setup：

```md
# Electron Lab

日常桌面工具 + Electron API 实验室。用沙箱和白名单 IPC 把笔记、剪贴板、文件和常见 Electron API 做成可点的模块，面向学习和自用。

仓库：<https://github.com/julytian/electron-study>

## 开发

需要 Node 22 与 pnpm。

```bash
pnpm install
pnpm dev
```

检查：

```bash
pnpm test
pnpm typecheck
pnpm lint
```

## 打包

```bash
pnpm build:mac
pnpm build:win
pnpm build:linux
```

本仓库不做代码签名和 macOS 公证（`electron-builder` 的 `notarize` 为 `false`）。未签名的 macOS 包可能要在「隐私与安全性」里允许打开；Windows 可能被 SmartScreen 拦截。

## 更新

正式包会检查 GitHub Releases。仓库里还没有 Release 时，检查会失败并 toast，不会退出。开发态不请求 GitHub，只用 mock。

## 安全

默认 `sandbox`、`contextIsolation`，渲染进程关闭 `nodeIntegration`。页面只能走白名单 IPC。开发态的 `userData` 目录带 `-dev` 后缀，避免和正式包装在一起。

## 协议

深链形如 `electron-lab://note/:id`，由主进程校验后再打开对应笔记。

## 许可证

MIT。见 [LICENSE](LICENSE)。
```

注意：外层是计划的 markdown 围栏。写入 README 时只要里面那一份（从 `# Electron Lab` 到 MIT 那行），不要把计划的围栏写进去套娃。

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs: 重写公开仓库 README

EOF
)"
```

---

### Task 5: 关于页仓库与签名说明

**Files:**

- Modify: `src/renderer/src/views/AboutView.vue`

- [ ] **Step 1: 加打开仓库**

在 `openLogs` 旁增加：

```ts
async function openRepo(): Promise<void> {
  await invokeIpc('shell:open-external', 'https://github.com/julytian/electron-study')
}
```

在 `a-descriptions` 里 `userData` 项后面、`更新` 项前面插入：

```vue
      <a-descriptions-item label="仓库">
        <a-button type="link" style="padding: 0" @click="openRepo">打开仓库</a-button>
      </a-descriptions-item>
```

把签名 alert 的 `description` 改成：

```
macOS 公证和 Windows 签名需要证书。本仓库 electron-builder 的 notarize 为 false，没有证书就不做签名或公证。未签名的安装包需要在系统设置里手动允许打开。
```

不要改 `showMockHint`。底部按钮区也可再放一个「打开仓库」，但 descriptions 里那一个就够。无 `v-html`。

- [ ] **Step 2: typecheck**

```bash
pnpm typecheck
```

Expected: 通过。

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/views/AboutView.vue
git commit -m "$(cat <<'EOF'
feat: 关于页可打开仓库并补充未签名说明

EOF
)"
```

---

### Task 6: 全量验证

- [ ] **Step 1:**

```bash
pnpm test
pnpm typecheck
pnpm lint
```

Expected: 全部绿（lint 允许既有 prettier warning，error 必须为 0）。

- [ ] **Step 2:** 若 Step 1 已绿且无未提交，本任务无新 commit。有漏网则：

```bash
git add -u
git commit -m "$(cat <<'EOF'
fix: 收口公开上架的类型与测试

EOF
)"
```

不要 push（留给 Task 7）。

---

### Task 7: 推分支并开 PR

**仅在 Task 6 全绿后执行。** 在 worktree 里操作。需要网络。

- [ ] **Step 1: 确认分支干净**

```bash
git status
git log --oneline master..HEAD | head
```

Expected: worktree 干净；`feat/best-practices` 相对 `master` 含最佳实践 + 本期提交。

- [ ] **Step 2: push 并开 PR**

```bash
git push -u origin HEAD
gh pr create --title "公开仓库上架与安全加固" --body "$(cat <<'EOF'
## Summary
- 合并最佳实践期：Session 安全、正式包 CSP / DevTools 快捷键、CI、对照表
- 公开仓库身份：README、MIT、author/homepage、窗口标题
- 正式包去掉检查菜单；关于页可打开仓库

## Test plan
- [ ] `pnpm test` / `typecheck` / `lint`（CI）
- [ ] 开发态标题为 Electron Lab，DevTools 菜单仍在
- [ ] 关于页「打开仓库」能打开 GitHub
- [ ] README 能按步骤 `pnpm install` && `pnpm dev`

EOF
)"
```

不要 `git push origin master`。不要删除 worktree。把 PR URL 写进报告。

若 `gh` 未登录或 push 被拒：Status `BLOCKED`，写明错误，不要改用 force push。

---

## Spec 覆盖

| 规格 | 任务 |
| --- | --- |
| `isDevtoolsMenuRole` / `withoutDevtoolsMenuItems` | Task 1 |
| 正式包 `setApplicationMenu`，开发态不改 | Task 2 |
| 帮助「打开仓库」 | Task 2 |
| author / homepage / description / title / LICENSE | Task 3 |
| README 七节 | Task 4 |
| 关于页仓库 + 未签名一句 | Task 5 |
| test / typecheck / lint | Task 6 |
| push 特性分支 + PR | Task 7 |
| 不签名、不加深实验室、不新通道 | 全程 |
