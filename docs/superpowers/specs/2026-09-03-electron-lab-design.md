# Electron Lab 设计说明

日期：2026-09-03
状态：已实现
仓库：`electron-study`

## 1. 背景与目标

本项目是一套 **日常桌面工具 + Electron API 实验室** 的学习用应用。用最新稳定 Electron 与官方 [electron-vite](https://electron-vite.org) 脚手架，按安全模型与工程规范把常用桌面能力做成可点、可查、可对照的模块。

成功标准：

- 工具页能完成真实任务（笔记、剪贴板、文件、下载等），数据可持久化。
- 实验室页能拆开演示对应 API，并写清安全边界。
- 默认启用上下文隔离与沙箱；渲染进程无 Node；IPC 白名单且带类型。
- 设置走键值存储，业务数据走 SQLite；更新对接 GitHub Releases（开发态用 mock）。
- 按分期交付，每一期都能 `pnpm dev` 跑通再进入下一期。

非目标（刻意不做）：

- 渲染进程开启 `nodeIntegration` 或关闭 `webSecurity`。
- 把无边框窗口当作默认壳。
- 无证书情况下强行做代码签名 / 公证。
- HID / 串口 / Bluetooth、完整 i18n、字节码混淆作为主线。

## 2. 产品形态

单一主窗口 + 按需子窗口。侧栏分五组：**工作台、窗口中心、迷你浏览器、实验室、设置**。

- **工具**：把一件事做完，写业务数据。
- **实验室**：同一 API 的拆解页，固定四块——能做什么 / 可点击演示 / 代码要点 / 安全注意。
- 两边可互相跳转。当前操作系统没有的能力保留入口、禁用按钮并说明原因。

底栏固定：平台、Electron 版本、更新状态、数据库是否就绪。
全局 `Cmd/Ctrl+K` 命令面板用于跳转模块。危险操作（清空库、注册协议）二次确认。

### 2.1 导航

```
主窗口
├── 工作台
│   ├── 剪贴板工作台
│   ├── 本地笔记              # 可选 safeStorage；支持 myapp://note/:id
│   ├── 文件与拖放            # 打开/保存/拖进/拖出/显示位置/回收站
│   ├── 截图与桌面捕获
│   ├── 下载中心
│   ├── 打印与 PDF
│   └── 系统能力              # 通知、托盘、开机自启、电源、主题
├── 窗口中心
│   ├── 窗口实验室            # 多窗、悬浮、全屏、进度条、父/子窗
│   ├── 现代窗口外观          # titleBarOverlay / Mica / 交通灯
│   └── 跨窗口通信            # MessagePort
├── 迷你浏览器                # WebContentsView + 独立 Session
├── 实验室
│   ├── 进程与安全
│   ├── 窗口与视图
│   ├── 系统与桌面
│   ├── 文件与网络
│   ├── 媒体与捕获
│   ├── 原生 UI
│   ├── 深链与文件关联
│   ├── 网络拦截与代理
│   ├── 平台集成              # Jump List / 任务栏缩略图 / Dock / TouchBar
│   ├── 安全存储
│   ├── 进程与性能
│   └── 进阶                  # 更新、utilityProcess、崩溃、SQLite、Fuses
├── 设置                      # 通用 / 存储 / 更新 / 快捷键 / 协议注册
└── 关于 / 诊断
```

平台差异：TouchBar、Jump List、Dock 菜单按系统显示；不支持则禁用并说明。

## 3. 技术栈

| 层     | 选择                                                                                             |
| ------ | ------------------------------------------------------------------------------------------------ |
| 运行时 | 最新稳定版 Electron                                                                              |
| 构建   | electron-vite（alex8088）+ electron-builder                                                      |
| 渲染   | Vue 3 Composition API、`<script setup lang="ts">`、TypeScript、Vue Router、Pinia、ant-design-vue |
| 工具库 | `@electron-toolkit/preload`、`@electron-toolkit/utils`                                           |
| 配置   | electron-conf                                                                                    |
| 业务库 | better-sqlite3（仅主进程，WAL）                                                                  |
| 更新   | electron-updater，GitHub Releases + blockmap 增量                                                |
| 包管理 | pnpm，Node.js 20.19+ 或 22.12+                                                                   |

安全默认值：`contextIsolation: true`、`sandbox: true`、`webSecurity: true`、`nodeIntegration: false`。生产启用 Electron Fuses（`runAsNode=false`、仅从 asar 加载等）。自定义协议使用 `protocol.handle`。

## 4. 架构

### 4.1 进程职责

| 进程           | 允许                                                               | 禁止                                                      |
| -------------- | ------------------------------------------------------------------ | --------------------------------------------------------- |
| 主进程         | 窗口、托盘、菜单、对话框、数据库、更新、协议、下载、打印、平台集成 | UI 状态、Ant Design 组件                                  |
| preload        | `contextBridge` 转发白名单                                         | 业务逻辑、读盘、直接查 SQL                                |
| 渲染进程       | 页面、Pinia、交互                                                  | `require('fs')`、裸 `ipcRenderer`、自行拼绝对路径访问磁盘 |
| utilityProcess | 大文本导出、耗时统计、崩溃隔离演示                                 | 创建窗口、调用 `app`                                      |

迷你浏览器使用独立 `session.fromPartition('persist:browser')`。`webRequest`、代理、证书处理只作用在该 Session，与主界面隔离。

### 4.2 目录

```
src/
├── main/
│   ├── index.ts
│   ├── windows/
│   ├── services/
│   ├── ipc/
│   └── platforms/
├── preload/
│   └── index.ts
├── renderer/
│   └── src/
│       ├── layouts/
│       ├── views/
│       ├── components/
│       ├── stores/
│       └── composables/
└── shared/
    ├── ipc.ts
    └── models.ts
```

路由页只做拼装。列表、表单、实验室演示区分组件。Pinia 只缓存 UI 状态；权威数据在主进程。

### 4.3 IPC

- 通道名：`域:动作`，例如 `notes:list`、`downloads:pause`。
- 请求-响应用 `ipcMain.handle` + `invoke`；进度、托盘、深链用主进程推事件。
- `src/shared/ipc.ts` 定义入参 / 出参类型，preload 按该表生成 `window.api`，禁止手写第二套。
- 渲染侧只调用 `window.api.notes.create(...)` 这类命名空间方法。
- 主进程每个 handle 先校验再执行。路径必须 `path.resolve`，并限制在用户选定目录或 `app.getPath('userData')`。
- 禁止把整个 `ipcRenderer` 暴露给渲染进程。
- 窗口 ID、WebContents ID 不交给渲染进程随意操控，只暴露业务命令（如创建悬浮窗）。

深链路径：系统 → 主进程 `open-url` 或二次实例 `argv` → 校验 → 事件 `deep-link:open` → 渲染进程路由到笔记。

协议名：`electron-lab://`（实现时与 `app.setAsDefaultProtocolClient` 保持一致）。笔记深链形如 `electron-lab://note/12`。

## 5. Electron 实践约束

以下条目是实现约束，不是可选建议。

**进程与安全**

- 渲染进程视为不可信。IPC 入参一律校验（路径、URL、枚举）。
- `session` 默认拒绝权限，按页面白名单放行（剪贴板、媒体、通知）。
- 拦截 `will-navigate` 与 `setWindowOpenHandler`。
- `shell.openExternal` 只允许 `https:` 与 `mailto:`。
- 渲染进程 CSP。剪贴板 HTML 消毒后再展示，禁止对不可信内容直接 `v-html`。
- 实验室中「危险 API」用开关 + 文案，默认走安全路径；关闭沙箱的对比仅开发环境可见。

**窗口与生命周期**

- `app.requestSingleInstanceLock()`，二次启动聚焦已有窗口。
- `ready-to-show` 后再 `show()`。
- 窗口几何写入 electron-conf，下次恢复。
- macOS：关窗隐藏不退出。Windows / Linux：可配置关闭到托盘。
- 退出时注销全局快捷键、销毁托盘、关闭 SQLite。
- 子窗口由主进程创建，父窗口关闭时一并销毁。

**系统集成**

- 主题跟随 `nativeTheme`，设置可覆盖。
- 通知点击回到对应页面。
- 托盘菜单：打开、剪贴板、检查更新、退出。
- 全局快捷键可配置，冲突时提示，`will-quit` 时 `unregisterAll`。
- 开机自启使用 `app.setLoginItemSettings`。

**工程**

- 原生模块放 `dependencies`，并配置 asar unpack。
- 主进程写日志到 `userData/logs/`（按天切割）。
- 生产开启 `crashReporter`（可先本地 dump）。

## 6. 数据设计

### 6.1 分层

| 存储          | 路径                     | 内容                                                       |
| ------------- | ------------------------ | ---------------------------------------------------------- |
| electron-conf | `userData/config.json`   | 主题、托盘、开机自启、快捷键、窗口几何、更新偏好、上次路由 |
| SQLite        | `userData/app.db`（WAL） | 笔记、剪贴板历史、下载、最近文件、实验室日志               |

仅主进程访问。开发态目录加 `-dev` 后缀。

### 6.2 配置字段

- `appearance.theme`：`system` | `light` | `dark`
- `window.main`：`x`、`y`、`width`、`height`、`isMaximized`
- `behavior.closeToTray`、`behavior.openAtLogin`
- `shortcuts`：打开主窗、剪贴板、笔记
- `updater.autoCheck`（默认 true）、`updater.autoDownload`（默认 false）
- `protocol.registered`
- `ui.lastRoute`

### 6.3 表结构

启动用 `PRAGMA user_version` 做 migration，禁止每次启动只跑 `CREATE IF NOT EXISTS`。

**notes**

- `id` INTEGER PK
- `title` TEXT
- `body` TEXT
- `body_cipher` TEXT
- `is_encrypted` INTEGER
- `pinned` INTEGER
- `created_at` INTEGER
- `updated_at` INTEGER

加密开启时 `body` 为空，密文进 `body_cipher`，密钥由 `safeStorage` 保护。

**clipboard_items**

- `id` INTEGER PK
- `kind` TEXT（`text` | `html` | `image`）
- `text` TEXT
- `html` TEXT
- `image_path` TEXT
- `created_at` INTEGER

图片文件放在 `userData/clipboard/`，表中只存路径。

**downloads**

- `id` INTEGER PK
- `url` TEXT
- `filename` TEXT
- `save_path` TEXT
- `state` TEXT
- `received` INTEGER
- `total` INTEGER
- `created_at` INTEGER
- `finished_at` INTEGER

**recent_files**

- `id` INTEGER PK
- `path` TEXT
- `opened_at` INTEGER

路径失效则启动时清理。供最近文档与 Jump List 使用。

**lab_events**

- `id` INTEGER PK
- `module` TEXT
- `action` TEXT
- `ok` INTEGER
- `message` TEXT
- `created_at` INTEGER

设置页提供：导出数据库、清空业务表、打开数据目录。

## 7. 更新

1. 启动约 10 秒后，若 `autoCheck` 则静默 `checkForUpdates`。
2. 发现新版本：关于页与底栏显示「有更新」。
3. 用户点击下载，或开启 `autoDownload` 后自动下载。使用 GitHub Releases + blockmap 增量。
4. 进度通过 `updater:progress` 推到渲染进程。
5. 下载完成后提示重启；若笔记未保存则先拦截。
6. 开发环境不请求真实 GitHub。实验室「进阶」页用 mock 走完 `checking` / `available` / `downloading` / `downloaded` / `error`。

第一期以跑通检查、下载、重启为准。代码签名写入文档；没有证书时不阻塞开发。

## 8. 错误处理

IPC 统一形状：

```ts
{ ok: true, data: T } | { ok: false, error: { code: string, message: string } }
```

稳定错误码：`E_VALIDATION`、`E_PATH`、`E_NOT_FOUND`、`E_ENCRYPT`、`E_NETWORK`、`E_UPDATE`、`E_PLATFORM`。

- 渲染进程用消息提示 `error.message`，不展示堆栈。
- 主进程日志写入 `userData/logs/`；关于 / 诊断可打开日志目录。
- 路由级错误页；未捕获 Promise 给出提示。
- 生产 `crashReporter`；实验室可查看最近崩溃文件是否存在。
- `uncaughtException` / `unhandledRejection` 记日志。仅在数据库无法打开等致命情况才退出。
- 笔记保存、下载、更新失败均可重试。

## 9. 界面约定

- 壳：ant-design-vue `Layout` + 分组侧栏。主题跟随系统，设置可强制浅色 / 深色。
- 第一期使用系统标题栏。「现代窗口外观」页单独演示 `titleBarOverlay` / Mica，不作为默认壳。
- 工具页：列表 + 详情 + 主操作；具备空状态与失败重试。
- 实验室页：说明 / 演示 / 要点 / 安全注意。
- 不支持的平台能力：入口可见、按钮禁用、文案说明。

## 10. 实现分期

目录与路由一次铺齐，功能按垂直切片实现。

| 期            | 交付                                                                | 验收要点                 |
| ------------- | ------------------------------------------------------------------- | ------------------------ |
| P0 骨架       | 脚手架、安全窗口、typed IPC、conf、SQLite migration、日志、单实例   | 壳能开，设置能存，库能建 |
| P1 核心工具   | 笔记（含加密）、剪贴板、文件拖进拖出                                | 系统读写 + 两层存储      |
| P2 系统与窗口 | 系统能力、窗口实验室、现代外观、MessagePort                         | 托盘 / 通知 / 多窗       |
| P3 浏览与网络 | 迷你浏览器、下载、打印 PDF、webRequest / 代理 / 证书                | Session 隔离             |
| P4 系统集成   | 深链、文件关联、最近文档、Jump List / Dock / TouchBar               | 从系统调起应用           |
| P5 进阶       | 更新（GitHub + mock）、性能面板、utilityProcess、崩溃、实验室页补全 | 发布与诊断闭环           |

每一期结束必须能 `pnpm dev` 运行且对应页面可操作，再开始下一期。

## 11. 测试与验收

从 P0 开始：

- `vue-tsc` 与 ESLint；CI 至少 typecheck。
- 主进程 IPC：校验失败与路径逃逸（`../`）必须拒绝。
- 渲染层纯函数（错误码映射、路由表）可单测。

各期手验：

1. 渲染进程 `typeof require === 'undefined'`，沙箱开启。
2. 笔记加密后重启仍可解密；数据库文件中无明文。
3. 剪贴板图文、拖出到桌面、下载暂停与完成。
4. 深链 `electron-lab://note/:id` 落到对应笔记。
5. 迷你浏览器 cookie 不影响主界面。
6. 开发态更新走 mock 五态；有 Releases 后再验真实检查。
7. 二次启动聚焦已有窗口，不新开进程。
8. 不支持平台的按钮禁用且有说明。

Playwright 驱动 Electron 放到 P5 之后，不阻塞主线。

## 12. 组件边界（渲染进程）

- `AppLayout`：侧栏、底栏、命令面板、主题。
- 各路由视图：只组合功能组件，不直接堆业务。
- 工具功能：容器 + 列表 / 表单 + 状态条，逻辑进 `composables/useXxx.ts`。
- 实验室：`LabPage` 壳（四段布局）+ 各模块演示控件。
- 跨窗口演示：主进程创建成对窗口；渲染进程只发「创建 / 发送消息」。

## 13. 风险与取舍

- `better-sqlite3` 需原生编译与 asar unpack，P0 必须先打通打包配置，否则后面全堵。
- 深链与文件关联在开发态（未安装包）行为与安装后不同，实验室需分别说明。
- 无代码签名时，Windows 增量更新可能失败，P5 以 mock + 有签名时的文档为准。
- TouchBar 仅部分 Mac 机型存在，按运行时能力检测，不按「是 macOS」一刀切。
