# Electron Lab 公开仓库上架

日期：2026-09-03
状态：待实现
仓库：`electron-study`（`julytian/electron-study`，已公开）
前序：`docs/superpowers/specs/2026-09-03-best-practices-design.md`
工作分支：`feat/best-practices`（最佳实践期已落地，本期叠在其上）

## 1. 背景与目标

主线、A / C 期和最佳实践期（安全加固、CI、对照表）已在 `feat/best-practices` 完成。仓库已公开，但对外身份仍是 electron-vite 脚手架：README 是模板，`author` / `homepage` 是示例，窗口标题是「Electron」，没有 LICENSE。正式包在 macOS 上还会露出默认菜单里的 Toggle Developer Tools。

本期把仓库做到「陌生人能 clone、能构建、能看懂边界」；不做签名，不加深实验室。

成功标准：

- `package.json` 的 `author`、`homepage`、`description` 指向本项目；窗口标题为 Electron Lab。
- 根目录有 MIT `LICENSE`。
- README 用中文写清：是什么、怎么跑、怎么打包、无签名、更新依赖 Releases、安全模型、协议名。
- 正式包应用菜单不再出现「检查元素 / Toggle Developer Tools」；开发态仍用 Electron 默认菜单。
- 关于页能打开 GitHub 仓库；签名说明补一句未签名包需系统手动允许。
- 做完后合进 `master` 并 push，GitHub Actions 对 `master` 跑 test / typecheck / lint。

非目标：

- 代码签名、公证、购买证书、打 GitHub Release。
- 首次启动向导、CHANGELOG、改应用图标、改 `appId` / 协议名。
- B 期加深实验室、Playwright、关沙箱对比。
- 禁用 `webContents.openDevTools`。
- 新 invoke 通道。

## 2. 身份

| 位置 | 值 |
| --- | --- |
| `package.json` `description` | `日常桌面工具与 Electron API 实验室` |
| `package.json` `author` | `julytian` |
| `package.json` `homepage` | `https://github.com/julytian/electron-study` |
| `repository` | 保持已有 `https://github.com/julytian/electron-study.git` |
| `src/renderer/index.html` `<title>` | `Electron Lab` |
| `LICENSE` | MIT，`Copyright (c) 2026 julytian` |

`appId`（`com.electronlab.app`）、`productName`（Electron Lab）、协议名不改。

关于页增加「仓库」一项。按钮或链接文案：「打开仓库」。点击 `invokeIpc('shell:open-external', 'https://github.com/julytian/electron-study')`。该 URL 已是 `https:`，现有 allowlist 可通过。

签名说明保留，并补一句：「未签名的安装包需要在系统设置里手动允许打开。」

## 3. README

覆盖根目录 `README.md`（不要再写 electron-lab-scaffold / Recommended IDE Setup 当正文）。中文，章节至少：

1. **Electron Lab** — 日常桌面工具 + Electron API 实验室；面向学习和自用。
2. **开发** — `pnpm install`、`pnpm dev`；`pnpm test`、`pnpm typecheck`、`pnpm lint`。
3. **打包** — `pnpm build:mac` / `build:win` / `build:linux`。没有签名和公证。macOS 可能要在「隐私与安全性」允许；Windows 可能被 SmartScreen 拦。
4. **更新** — 正式包检查 GitHub Releases。仓库还没有 Release 时检查会失败并 toast，不退出。开发态走 mock。
5. **安全** — 沙箱、上下文隔离、渲染进程无 Node、IPC 白名单。开发态 `userData` 目录带 `-dev`。
6. **协议** — `electron-lab://note/:id`。
7. **许可证** — MIT。

不要求列全部门 IPC。不贴大段代码。

## 4. 正式包菜单

开发态：**不**调用 `setApplicationMenu`，沿用 Electron 默认菜单（含检查）。

正式包：`app.whenReady` 里、建窗之前（或紧挨着建窗）调用 `applyApplicationMenu(true)`，`Menu.setApplicationMenu` 一套不含开发者工具的模板。

抽纯函数（不 import electron 值）：

- `isDevtoolsMenuRole(role: string | undefined): boolean` — `toggledevtools`（大小写不敏感）为 true。
- `withoutDevtoolsMenuItems(items)` — 递归去掉上述 role，以及 label 含「Toggle Developer Tools」或「检查元素」的项；空 submenu 的父项也去掉。

模板自己写一份精简菜单即可（macOS 应用菜单、编辑、窗口、帮助打开仓库）。View 菜单不要 `toggleDevTools`。不要 wrap `openDevTools`。

主窗已有 `autoHideMenuBar: true`，Windows / Linux 正式包菜单栏仍按现有窗口设置，不为此改成始终显示。

## 5. 测试与落地

Vitest，不启窗口：

- `isDevtoolsMenuRole('toggleDevTools')` / `'toggledevtools'` 为 true；`'reload'` / `'quit'` / `undefined` 为 false。
- `withoutDevtoolsMenuItems` 能剥掉嵌套的 toggleDevTools，留下 reload。

不测：真打包、真 push、README 渲染。

完成前：

```bash
pnpm test
pnpm typecheck
```

实现后跑 `pnpm lint`。

落地（实现全部绿之后）：

1. 在本分支提交本期改动。
2. 把 `feat/best-practices` 合进本地 `master`。
3. `git push -u origin feat/best-practices` 并开 PR，或按你当时选择 push `master`。默认：**push 特性分支并开 PR 到 `master`**（CI 在 PR 上跑，避免直接推未审过的 master）。若你更想直接推 `master`，实现结束时再说一声。

## 6. 文件地图

```
package.json
LICENSE
README.md
src/renderer/index.html
src/renderer/src/views/AboutView.vue
src/main/windows/app-menu.ts
src/main/index.ts
tests/app-menu.test.ts
```

不改 preload，不改 `invokeChannels`。
