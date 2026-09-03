# Electron Lab 最佳实践（安全加固与 CI）

日期：2026-09-03
状态：待实现
仓库：`electron-study`（`julytian/electron-study`，已公开）
前序：`docs/superpowers/specs/2026-09-03-electron-lab-design.md`、`docs/superpowers/specs/2026-09-03-spec-closeout-design.md`、`docs/superpowers/specs/2026-09-03-workbench-ux-design.md`

## 1. 背景与目标

主线、A 期（规格收口）和 C 期（工作台体验）已落地。安全默认值（沙箱、上下文隔离、无 Node、Fuses 声明）已经有了，但仍缺工程上该补的一层：GitHub Actions、Session 级权限检查、`will-redirect` / `will-attach-webview`、正式包 CSP 响应头、正式包挡调试快捷键、`package.json` 的 `repository`（公开仓库后才能走真更新）、关于页对签名/公证的说明、实验室对照表。

本期把这些收完。B 期（加深实验室 API）不在本期。

成功标准：

- `push` / `pull_request` 到 `master` 时，CI 跑 `pnpm test`、`typecheck`、`lint`。
- 主界面与 `persist:browser` 都挂上 Session 安全：权限检查、拒绝 `<webview>`；主界面另有与现有导航一致的 `will-redirect`，正式包另有 CSP 响应头。
- 正式包拦截常见 DevTools 快捷键，不提供「检查元素 / Toggle Developer Tools」菜单项；**不**禁用 `webContents.openDevTools`。
- `package.json` 写明 GitHub 仓库后，正式包检查更新走 Releases；失败 toast，不挡启动。开发态仍 mock。
- 「进程与安全」页能看到对照表，并能查出 packaged / CSP Session / 权限检查 / Fuses 声明。
- 关于页写清：本仓库 `notarize: false`，没有证书就不做签名/公证。

非目标：

- 真代码签名、公证、购买证书。
- 正式包禁用 `openDevTools` API。
- Playwright e2e、关沙箱对比。
- 本期不 `git push`（仓库已公开，推送等你说）。
- 新 preload 形态或新的 invoke 通道名；只复用 `lab:run`。
- 改迷你浏览器的网址放行策略（用户打开的第三方站仍可跳转）。
- 改 `homepage` / `author` 等与本期无关的 package 字段。

## 2. 架构

两处挂载，职责分开：

| 函数 | 作用对象 | 职责 |
| --- | --- | --- |
| `attachSessionSecurity(session, kind)` | `session.defaultSession`（`kind: 'app'`）、`persist:browser`（`kind: 'browser'`） | 权限请求 + 权限检查、拒绝 webview、按 kind 决定 redirect / CSP |
| `attachWindowSecurity(win)` | `createMainWindow` / `createChildWindow` / `createFloatWindow` | 正式包 `before-input-event` 拦 DevTools 快捷键 |

对照表数据放 `src/shared/security-checklist.ts`，主进程与渲染进程都能读。Fuses **声明值**放 `src/shared/electron-fuses.ts`，与 `electron-builder.yml` 的 `electronFuses` 逐项一致；运行时不探测 Electron 内部 fuse，实验室只展示这份声明。

启动顺序（`app.whenReady` 内、建窗之前）：

1. `attachSessionSecurity(session.defaultSession, 'app')`，替换 `src/main/index.ts` 里现有的 `setPermissionRequestHandler` 单行。
2. `getBrowserSession()` 内部改为调用 `attachSessionSecurity(ses, 'browser')`，不再自己写一份「一律 false」的 request handler（行为保持：浏览器分区权限全拒绝）。
3. 建主窗 / 子窗时 `attachRendererNavigation` 之后（或一并）调用 `attachWindowSecurity`。

`@electron-toolkit/utils` 的 `optimizer.watchWindowShortcuts` 保留。正式包快捷键以 `attachWindowSecurity` 为准，两者可以同时存在。

## 3. Session 安全

### 3.1 权限

抽出判断函数（可继续放在 `session-permissions.ts`）：

- `isSessionPermissionAllowed(kind, permission)`
- `kind === 'app'`：白名单与现有一致——`notifications`、`clipboard-read`、`clipboard-sanitized-write`、`media`、`display-capture`、`fullscreen`
- `kind === 'browser'`：一律 `false`

`setPermissionRequestHandler` 与 `setPermissionCheckHandler` 都走同一函数。未列入白名单的（如 `geolocation`、`openExternal`、`pointerLock`）拒绝。

### 3.2 拒绝 webview

对已挂载 Session 上创建的 `webContents`，监听 `will-attach-webview`，`event.preventDefault()`。主界面与浏览器分区都拒绝。实现可挂在 `app.on('web-contents-created')`，按 `contents.session` 是否已 attach 决定。

### 3.3 重定向

**仅 `kind === 'app'`。** `will-redirect` 与现有 `will-navigate` 共用 `isRendererNavigationAllowed(current, url, is.dev)`：不允许则 `event.preventDefault()`；若目标是外链 allowlist（`https:` / `mailto:`），再 `shell.openExternal`，规则与 `attachRendererNavigation` 相同。

`kind === 'browser'` **不**用渲染进程导航规则拦 redirect。迷你浏览器要打开第三方站，跳转由现有浏览器逻辑处理。

`will-navigate` / `setWindowOpenHandler` 仍留在 `attachRendererNavigation`，不搬进 Session 模块。

### 3.4 CSP（仅正式包、仅 app）

常量函数 `cspHeader()`，字符串与 `src/renderer/index.html` 的 meta 完全一致：

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:
```

仅当 `app.isPackaged && kind === 'app'` 时，`session.webRequest.onHeadersReceived` 给文档响应加上 `Content-Security-Policy`。开发热更新不挂，避免挡 Vite。

不加在 `persist:browser` 上，避免覆盖用户打开的第三方站。

`index.html` 的 meta 保留，作为开发态与双保险。

## 4. 窗口与 DevTools

`attachWindowSecurity(win)`：

- 开发态：直接返回，不注册拦截。
- 正式包：`win.webContents.on('before-input-event', ...)`，若 `isDevtoolsShortcut(input)` 则 `event.preventDefault()`。

`isDevtoolsShortcut` 只认这些（macOS 用 `meta`，Windows / Linux 用 `control`）：

| 组合 | 说明 |
| --- | --- |
| Cmd/Ctrl + Alt + I | 常见 Toggle DevTools |
| Cmd/Ctrl + Shift + I | Windows / Linux 常见 Toggle DevTools |
| F12 | 检查 |
| Cmd + Alt + J | macOS Console |
| Ctrl + Shift + J | Windows / Linux Console |

普通字母、复制、刷新（Cmd/Ctrl+R）、地址栏输入不拦截。

菜单：正式包不提供「检查元素」或「Toggle Developer Tools」项。当前没有自定义应用菜单 / 右键检查项则保持不加。不在正式包里禁用或 wrap `openDevTools`。

## 5. 仓库、更新、关于页

`package.json` 增加：

```json
"repository": {
  "type": "git",
  "url": "https://github.com/julytian/electron-study.git"
}
```

现有 `parseGitHubRepository` / `readPackageRepository` / `canUseReal = app.isPackaged && repository !== null` 不用改逻辑。开发态或未打包仍 mock。正式包检查 GitHub 失败：已有 `updater:status` error + toast，不挡启动。

`electron-builder.yml` 的 Linux `maintainer` 从 `electronjs.org` 改为 `julytian`（或同等能表明本项目的值），不要再写 Electron 官网。

关于页：

- 增加「发布与签名」一小段：macOS 公证、Windows 签名需要证书；本仓库 `notarize: false`，没有证书就不做。
- 已有 `hasRepository` 判断保留。正式包且已填仓库时，不再强调「只能 mock」；开发态或没有仓库时，现有 info 提示保留。

## 6. CI

新增 `.github/workflows/ci.yml`：

- 触发：`push`、`pull_request`，分支 `master`
- 系统：`ubuntu-latest`
- Node 22，`pnpm` 带缓存（`pnpm/action-setup` + `actions/setup-node` 的 `cache: pnpm`）
- 步骤：`pnpm install --frozen-lockfile`，然后 `pnpm test`、`pnpm typecheck`、`pnpm lint`
- 不跑 `electron-builder` / 打包

## 7. 进程与安全页

不新开路由，仍是 `/lab/security`。

### 7.1 对照表

`src/shared/security-checklist.ts` 导出只读数组，**正好 8 条**，字段：`id`、`title`、`file`（相对仓库根的路径）、`detail`（一句说明）。

| id | title | file |
| --- | --- | --- |
| `sandbox` | 窗口沙箱 | `src/main/windows/main.ts` |
| `context-isolation` | 上下文隔离 | `src/main/windows/main.ts` |
| `no-node` | 渲染进程无 Node | `src/main/windows/main.ts` |
| `permission-check` | Session 权限检查 | `src/main/services/session-permissions.ts` |
| `navigation` | 导航与重定向 | `src/main/windows/navigation.ts` |
| `no-webview` | 拒绝 webview | `src/main/services/session-security.ts` |
| `csp` | CSP meta 与正式包响应头 | `src/renderer/index.html` |
| `fuses` | Electron Fuses 声明 | `electron-builder.yml` |

`LabHostView` 在 `path === '/lab/security'` 时，在 `LabPage` **上方**用 `a-table` 展示。数据编译进渲染包，不经 IPC。无 `v-html`。

### 7.2 实验室动作

`catalog.ts` 安全页 actions 从 1 条变为 2 条：

| id | title |
| --- | --- |
| `app-info` | 查看应用与沙箱信息（已有） |
| `security-status` | 查看安全状态 |

`lab:run('security', 'security-status')` 仍返回 `{ message: string }`，`LabPage` 不用改。`message` 用分号拼可读字段，例如：

```
packaged=false; cspSession=false; permissionCheck=true; fuses.runAsNode=false; fuses.enableCookieEncryption=true; ...
```

字段含义：

- `packaged`：`app.isPackaged`
- `cspSession`：`app.isPackaged`（与「是否给 defaultSession 加了 CSP 头」同一条件）
- `permissionCheck`：恒为 `true`（表示已挂 `setPermissionCheckHandler`）
- `fuses.*`：`src/shared/electron-fuses.ts` 声明值，键与 `electron-builder.yml` 的 `electronFuses` 对齐

未知 `module/action` 仍 `E_VALIDATION`。不新开危险通道。

## 8. 测试与验收

Vitest，不启 Electron 窗口。

- **权限**：`isSessionPermissionAllowed('app', …)` 白名单与现有 `session-permissions` 测试一致；`isSessionPermissionAllowed('browser', …)` 对白名单内权限也是 `false`。
- **导航**：`will-redirect` 复用 `isRendererNavigationAllowed`，不另写一套；现有 `window-policy` 测试足够。
- **DevTools**：`isDevtoolsShortcut` 覆盖第 4 节五组组合（含 macOS `meta` 与 Windows `control`）；普通字母、`Ctrl+C`、`Ctrl+R` / `Meta+R` 为 `false`。
- **CSP**：`cspHeader()` 与 `index.html` meta 的 `content` 字符串全等。
- **对照表**：长度恒为 8；每条有非空 `id`、`title`、`file`、`detail`。
- **实验室目录**：12 条路由不变；`/lab/security` 的 action id 为 `['app-info', 'security-status']`。
- **仓库**：`parseGitHubRepository` 能解析 `https://github.com/julytian/electron-study.git`。现有 `readPackageRepository(仓库根)` 断言从「无 repository → null」改为期望 `{ owner: 'julytian', repo: 'electron-study' }`。
- **Fuses**：`electron-fuses.ts` 与 `electron-builder.yml` 中 `electronFuses` 块一致（读 yml 文本或解析键值均可，以测到声明漂移为准）。

不测：CI yaml 语法、关于页文案点击、正式包快捷键实机、真 GitHub Releases、签名、Playwright。

完成前命令：

```bash
pnpm test
pnpm typecheck
```

实现后本地再跑一次 `pnpm lint`。不要求 `pnpm build`。

手验（实现后由你本地点）：

1. 开发态：DevTools 快捷键仍可用；关于页仍提示 mock。
2. 「进程与安全」：表有 8 行；「查看安全状态」能看到 packaged / cspSession / permissionCheck / fuses。
3. CI 文件存在且步骤包含 test、typecheck、lint。

## 9. 错误处理

- `lab:run` 未知动作：`E_VALIDATION`（现有）。
- 正式包更新请求失败：`E_UPDATE` 或现有 updater error 通道，toast，不退出。
- Session / 窗口安全挂载失败（不应发生）：记主进程日志，不因此 `app.quit()`。

## 10. 文件地图

新增或修改（计划阶段可微调路径，行为以本文为准）：

```
.github/workflows/ci.yml
package.json
electron-builder.yml
src/shared/security-checklist.ts
src/shared/electron-fuses.ts
src/shared/csp.ts
src/main/services/session-permissions.ts
src/main/services/session-security.ts
src/main/services/browser-session.ts
src/main/windows/window-security.ts
src/main/windows/main.ts
src/main/windows/child.ts
src/main/windows/navigation.ts
src/main/index.ts
src/main/ipc/lab.ts
src/renderer/src/lab/catalog.ts
src/renderer/src/views/lab/LabHostView.vue
src/renderer/src/views/AboutView.vue
tests/session-permissions.test.ts
tests/devtools-shortcut.test.ts
tests/csp.test.ts
tests/security-checklist.test.ts
tests/lab-catalog.test.ts
tests/updater-mock.test.ts
tests/electron-fuses.test.ts
```

不改 preload 暴露方式。不改 `invokeChannels` 名单。
