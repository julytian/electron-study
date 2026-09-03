# Electron Lab 加固跟进（韧性 / 安全再收一层 / 工程卫生）

日期：2026-09-03
状态：待实现
仓库：`julytian/electron-study`
分支：`feat/best-practices`（同一 PR）
前序：`docs/superpowers/specs/2026-09-03-best-practices-design.md`、`docs/superpowers/specs/2026-09-03-public-launch-design.md`

## 1. 背景与目标

最佳实践期与公开上架已经落地：沙箱、隔离、无 Node、权限 request+check、`will-navigate` / `will-redirect` / 拒绝 webview、CSP meta + 正式包响应头、Fuses、正式包挡 DevTools 快捷键与应用菜单、CI（test / typecheck / lint）、公开身份。

仍缺三块，本期一次收完：

1. **运行时韧性：** 渲染进程挂了会白屏；没有 `render-process-gone` / `child-process-gone` 处理。
2. **安全再收一层：** 正式包右键仍可能出现「检查」；未挂 `setDisplayMediaRequestHandler` 与设备权限回调；CSP 还可加三条；preload 的 `postMessage` 仍用 `*`；未调用 `app.enableSandbox()`。
3. **工程卫生：** CI 没有 `pnpm audit`；`downloads:start` 走 `defaultSession.downloadURL`，和「下载属于浏览器分区」不一致。

成功标准：

- 主窗 `render-process-gone`（非 `clean-exit`）时 `reload`，连续失败最多 2 次；成功 `did-finish-load` 后计数归零。子窗 / 迷你浏览器 / GPU / utility 只记日志和 `lab_events`，不自动重建。
- 正式包右键菜单没有「检查」/ Toggle DevTools。开发态不改默认右键。
- 主界面与浏览器分区都拒绝 `getDisplayMedia`；截屏只走现有 `capture:*` IPC。HID / 串口 / USB / 蓝牙设备权限一律拒绝。
- CSP 在现有基础上增加 `object-src 'none'`、`base-uri 'self'`、`frame-ancestors 'none'`；`style-src 'self' 'unsafe-inline'` 不动。正式包 app Session 另加 `Permissions-Policy`。
- preload 转发 MessagePort 不再使用 `*`。
- `app.enableSandbox()` 在 `ready` 之前调用。
- `downloads:start` 与 `will-download` 只打 `persist:browser`。
- CI 增加 `pnpm audit --audit-level=high`；high / critical 失败。能升级就升级，不能升级则把 CVE 写入 `pnpm.auditConfig.ignoreCves` 并写明原因。
- 「进程与安全」对照表增到 11 行；「进程与性能」能查出最近进程事件；`security-status` 能看到 displayMedia / devicePermission / enableSandbox。

非目标：

- 真代码签名、公证、收紧 macOS entitlements。
- Playwright e2e、关沙箱对比、B 期加深实验室 API。
- 禁用 `webContents.openDevTools`。
- 新开 `invoke` / `event` 通道；只复用 `lab:run`、`lab:events`。
- 主窗 reload 后弹 toast（reload 会清掉渲染状态）。
- 额外拦截 `--inspect` / `--remote-debugging-port`（Fuses 已覆盖）。
- 改迷你浏览器的网址放行策略。

## 2. 架构

继续拆纯函数与挂载函数，挂载失败只记日志，不 `app.quit()`。

| 单元 | 职责 |
| --- | --- |
| `shouldReloadRenderer(input)` | 判断主窗这次 gone 要不要 reload |
| `attachProcessRecovery()` | 监听 `app` 级 gone 事件，主窗按计数 reload，一律写入 `lab_events` |
| `recordLabEvent(...)` | 从 `lab.ts` 抽出，供实验室动作和进程事件共用 |
| `attachSessionSecurity` 扩展 | display-media 拒绝、设备权限拒绝、正式包 Permissions-Policy |
| `cspHeader()` / `permissionsPolicyHeader()` | 响应头字符串；与 html meta / 测试对齐 |
| `portMessageTargetOrigin(origin)` | preload 转发 MessagePort 的 targetOrigin，禁止 `*` |
| `attachWindowSecurity` 扩展 | 正式包替换右键菜单 |
| CI `pnpm audit` | high / critical 失败 |

启动顺序（相对现有，只插两处）：

1. `app.whenReady` **之前**调用 `app.enableSandbox()`（与单实例锁同级，在文件前部）。
2. `whenReady` 里现有 `attachSessionSecurity(defaultSession, 'app')` 保持；`getBrowserSession()` 仍自己 attach `browser`。
3. `registerIpc()` 之后（数据库已开）调用 `attachProcessRecovery()`，这样 gone 事件能写入 `lab_events`。

## 3. 运行时韧性

### 3.1 是否 reload

纯函数，不碰 Electron：

```ts
shouldReloadRenderer({
  isMainWindow: boolean
  reason: string
  consecutiveReloads: number
  maxReloads?: number // 默认 2
}): boolean
```

规则：

- `isMainWindow === false` → `false`（子窗、迷你浏览器、其它 webContents 不 reload）。
- `reason === 'clean-exit'` → `false`。
- 其它 reason（`crashed` / `oom` / `abnormal-exit` / `killed` / `launch-failed` / `integrity-failure` 以及未知字符串）→ `consecutiveReloads < maxReloads`。

连续计数只对**主窗**维护。主窗 `did-finish-load` 后把计数置 0。达到上限后只记录，不再 reload。

### 3.2 挂载

`attachProcessRecovery()`：

- `app.on('render-process-gone', (_event, webContents, details))`
  - 用 `webContents.id === getMainWindow()?.webContents.id` 判断是不是主窗。
  - 若 `shouldReloadRenderer` 为真：计数 +1，`webContents.reload()`。
  - 无论是否 reload，都 `recordLabEvent('process', 'render-process-gone', ok, message)`。`ok` 表示「已决定 reload」；`message` 形如 `reason=crashed exitCode=1 main=true reload=true count=1`。
- `app.on('child-process-gone', (_event, details))`
  - 不重建进程。
  - `recordLabEvent('process', 'child-process-gone', false, message)`，`message` 含 `type` / `reason` / `exitCode`（字段以 Electron 实际 `details` 为准，缺的写成 `unknown`）。
- GPU 走 `child-process-gone`（`type === 'GPU'`），不再听已弃用的 `gpu-process-crashed`。

主窗被销毁或 `webContents` 已 destroyed 时不调用 `reload`。

### 3.3 实验室

抽出 `src/main/services/lab-events.ts`：

- `recordLabEvent(module, action, ok, message)`：现有 `INSERT INTO lab_events ...`，失败吞掉。
- `listLabEvents(limit = 50)`：现有 `lab:events` 查询。
- `formatRecentProcessEvents(rows, limit = 10)`：只保留 `module === 'process'`，按时间倒序，拼成一行可读文本。没有则返回 `暂无进程事件`。

`lab.ts` 改为调用上述函数，不再内联 SQL。

`lab:run('metrics', 'recent-gone')` 新增，返回 `{ message }`。`metrics` 的 `refresh` 保留。

`catalog.ts` 的 `/lab/metrics` actions 变为：

| id | title |
| --- | --- |
| `refresh` | 刷新进程摘要（已有） |
| `recent-gone` | 查看最近进程事件 |

`MetricsView` 在崩溃转储卡片下方加「进程事件」卡片：刷新时额外调用 `lab:run('metrics', 'recent-gone')`，展示 `message`。不新开路由，不用 `v-html`。

## 4. 安全再收一层

### 4.1 正式包右键

扩展 `attachWindowSecurity(win, packaged)`：正式包除现有快捷键拦截外，监听 `win.webContents` 的 `context-menu`：

- `event.preventDefault()`
- 弹出只含 `undo` / `redo` / `cut` / `copy` / `paste` / `selectAll` 的菜单
- 用 `isDevtoolsMenuRole` / 现有标签过滤，**不要**加入 `toggleDevTools` 或「检查」

开发态：不注册右键处理，保留默认检查项。

抽出 `attachPackagedContextMenu(webContents)` 与 `buildPackagedContextMenuTemplate()`（纯数据，便于测「不含 toggleDevTools」）。`attachWindowSecurity` 正式包时调用前者。

迷你浏览器是挂在主窗上的 `WebContentsView`，不是独立 `BrowserWindow`。正式包在 `createView()` 之后对 `view.webContents` 同样调用 `attachPackagedContextMenu`，否则嵌入页右键仍可能出现「检查」。开发态不挂。

### 4.2 display-media 与设备

在 `attachSessionSecurity` 里对 **app 与 browser 都挂**：

- `ses.setDisplayMediaRequestHandler((_request, callback) => { callback({}) })`  
  空回调即拒绝。渲染进程 `getDisplayMedia` 失败。工作台截屏继续走 `capture:sources` / `capture:save`。
- `ses.setDevicePermissionHandler(() => false)`  
  HID / 串口 / USB / 蓝牙选择器一律拒绝。

现有 `isSessionPermissionAllowed` 白名单不改（`display-capture` 仍在 app 白名单里，但 display-media handler 已拒绝页面级捕获；主进程 `desktopCapturer` 不受影响）。

### 4.3 CSP 与 Permissions-Policy

`src/shared/csp.ts` 的 `CSP_HEADER` 改为：

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'
```

`src/renderer/index.html` 的 meta `content` 必须与 `cspHeader()` **全等**。现有 `csp.test.ts` 继续约束这一点。`shouldAttachCsp` 条件不变：仅正式包 + `kind === 'app'`。

新增 `src/shared/permissions-policy.ts`：

```
geolocation=(), camera=(), microphone=(), payment=(), usb=(), serial=(), hid=(), bluetooth=(), display-capture=()
```

`shouldAttachPermissionsPolicy` 与 `shouldAttachCsp` 同条件。挂在同一处 `onHeadersReceived`：文档帧同时写 `Content-Security-Policy` 与 `Permissions-Policy`。开发态不挂，避免干扰 Vite。不挂在 `persist:browser`。

### 4.4 preload origin

`src/preload/index.ts`：

- 用 `window.location.origin` 作为 targetOrigin，**禁止** `'*'`。
- `message` 监听先比较 `event.origin === window.location.origin`，再看 `event.data === 'port'`。

抽出到 `src/shared/port-origin.ts`（preload 与测试都能 import）：

```ts
portMessageTargetOrigin(locationOrigin: string): string
isTrustedPortMessageOrigin(eventOrigin: string, locationOrigin: string): boolean
```

`portMessageTargetOrigin`：`locationOrigin` 非空则原样返回，否则返回 `'null'`（绝不返回 `*`）。  
`isTrustedPortMessageOrigin`：两者相等且都不为 `*`。

### 4.5 `app.enableSandbox()`

在 `src/main/index.ts` 顶部、`app.whenReady` 之前调用，开发态与正式包都调用。窗口级 `sandbox: true` 保留。

## 5. 工程卫生

### 5.1 CI audit

`.github/workflows/ci.yml` 在 `pnpm install --frozen-lockfile` 之后、`pnpm test` 之前增加：

```
pnpm audit --audit-level=high
```

high / critical 使 job 失败。moderate / low 不挡。

实现时在仓库根跑一次同一命令：

- 能靠升级依赖消掉的，升级并更新 lockfile。
- 消不掉的，把 CVE 写入 `package.json` 的 `pnpm.auditConfig.ignoreCves`，并在该字段旁或 README「安全」一小节用一句话写原因（例如「仅开发依赖 / 无修复版本」）。不要空 ignore。

不在本期引入 Dependabot 配置文件（GitHub 已有默认扫描即可）。

### 5.2 下载 Session

`downloads:start` 的 `downloadURL` 改为 `getBrowserSession().downloadURL(url)`。

`will-download` **只**监听 `persist:browser`，去掉 `session.defaultSession.on('will-download')`。

主窗 `print:pdf` / `capture:save` 仍写 exports 目录，不是 DownloadItem，不受影响。

`assertHttpsDownloadUrl` 等纯函数不改。

## 6. 对照表与安全状态

`SECURITY_CHECKLIST` 从 8 行改为 **11 行**，前 8 行 id 不变，后面追加：

| id | title | file |
| --- | --- | --- |
| `process-recovery` | 渲染进程崩溃恢复 | `src/main/services/process-recovery.ts` |
| `display-media` | 拒绝页面级屏幕捕获 | `src/main/services/session-security.ts` |
| `device-permission` | 拒绝 HID / 串口 / USB / 蓝牙 | `src/main/services/session-security.ts` |

`csp` 那一行的 detail 改为提到三条新指令与正式包 Permissions-Policy。

`formatSecurityStatus(packaged)` 在现有字段后追加（顺序固定，分号分隔）：

```
enableSandbox=true; displayMedia=deny; devicePermission=deny
```

`enableSandbox` 恒为 `true`（表示已调用 API，不是运行时探测）。实验室「查看安全状态」仍走 `lab:run('security', 'security-status')`。

## 7. 测试与验收

Vitest，不启 Electron 窗口。

- **reload 判定：** 主窗 + `crashed` + count 0/1 → `true`；count 2 → `false`；`clean-exit` → `false`；非主窗任意 reason → `false`；默认上限为 2。
- **进程事件文本：** 无行 → `暂无进程事件`；只收录 `module === 'process'`；条数上限 10。
- **CSP：** `cspHeader()` 与 `index.html` meta 全等，且包含 `object-src 'none'`、`base-uri 'self'`、`frame-ancestors 'none'`，并仍含 `style-src 'self' 'unsafe-inline'`。
- **Permissions-Policy：** 头字符串包含 `display-capture=()`、`usb=()`、`geolocation=()`；`shouldAttachPermissionsPolicy` 与 CSP 同条件。
- **右键模板：** `buildPackagedContextMenuTemplate()` 展平后没有任何 `toggleDevTools` role，标签不含「检查」。
- **port origin：** `portMessageTargetOrigin('*')` 不得返回 `*`（若传入 `*` 视为非法，返回 `'null'`）；`portMessageTargetOrigin('http://localhost:5173')` 原样返回；`isTrustedPortMessageOrigin('*', anything)` 为 `false`。
- **下载 URL：** 现有 https 校验测试保持。
- **对照表：** 长度 11；id 顺序与第 6 节一致。
- **实验室目录：** 12 条路由不变；`/lab/metrics` 的 action id 为 `['refresh', 'recent-gone']`；`/lab/security` 仍为 `['app-info', 'security-status']`。
- **security-status：** 开发态与正式包都含 `enableSandbox=true`、`displayMedia=deny`、`devicePermission=deny`。

不测：真崩溃重载实机、右键点击、`getDisplayMedia` 浏览器行为、CI yaml 语法、audit 的具体 CVE 列表（实现时以当时 `pnpm audit` 为准）、Playwright。

完成前命令：

```bash
pnpm test
pnpm typecheck
pnpm audit --audit-level=high
```

实现后本地再跑 `pnpm lint`。不要求 `pnpm build`。

手验（实现后由你本地点）：

1. 开发态：右键仍有检查；DevTools 快捷键仍可用。
2. 「进程与安全」表为 11 行；「查看安全状态」能看到新增三字段。
3. 「进程与性能」能看到「查看最近进程事件」（未崩溃时为「暂无进程事件」）。
4. 工作台下载仍只接受 https，任务能出现在列表（走浏览器 Session）。

## 8. 错误处理

- 未知 `lab:run`：`E_VALIDATION`（现有）。
- `recordLabEvent` 失败：吞掉，不影响 gone 处理与实验室动作。
- `reload` 抛错：记主进程日志，不退出。
- Session 安全 API 在旧 Electron 上若不存在（不应发生，当前主版本已具备）：try/catch 记日志，其余策略照挂。
- audit 失败：CI 红；本地按 5.1 升级或写入 ignoreCves。

## 9. 文件地图

新增或修改（计划阶段可微调路径，行为以本文为准）：

```
.github/workflows/ci.yml
package.json
src/shared/csp.ts
src/shared/permissions-policy.ts
src/shared/port-origin.ts
src/shared/process-gone.ts
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
tests/process-gone.test.ts
tests/lab-events-format.test.ts
tests/csp.test.ts
tests/permissions-policy.test.ts
tests/port-origin.test.ts
tests/context-menu.test.ts
tests/security-checklist.test.ts
tests/lab-catalog.test.ts
```

不改 `invokeChannels` / `eventChannels`。不改笔记加密、协议、更新 mock。
