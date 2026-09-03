# Electron Lab 规格收口（A 期）

日期：2026-09-03
状态：待实现
仓库：`electron-study`
前序：`docs/superpowers/specs/2026-09-03-electron-lab-design.md`

## 1. 背景与目标

原设计已落地主线，但仍有缺口：`recent_files` 只进库不进文件页；系统「最近文档」未同步；`theme:changed` / `power:changed` 有通道无推送；日志按体积切而不是按天；开机自启只在系统能力页。

本期把这些收完，并按约定接上 `app.addRecentDocument`、Jump List 与命令面板搜索。C（工具用顺）和 B（加深实验室）不在本期。

成功标准：

- 文件页能看到、打开、移除最近文件；失效路径启动时清掉。
- 打开/保存文件后，macOS / Windows 系统最近文档与自定义 Jump List 与 SQLite 一致（仍存在的路径）。
- Cmd/Ctrl+K 能搜到最近文件并打开。
- 设置页改主题、开机自启与系统能力页同一条 IPC。
- 系统主题或电源变化时，渲染进程不用轮询也能更新。
- 日志文件名为 `main-YYYY-MM-DD.log`。

非目标：

- 笔记未保存体验、剪贴板改版、新实验室 API 页。
- 给渲染进程暴露 `app.addRecentDocument`。
- 系统最近文档的单条删除 API（不存在）；移除一条时用「清空 + 用剩余行重建」。
- Playwright e2e。
- 改 preload 白名单形态；只追加 3 个 invoke 通道。

## 2. 最近文件

### 2.1 权威数据

SQLite `recent_files`（`id`、`path`、`opened_at`）是唯一权威。系统最近文档与 Jump List 是镜像。

同一 `path`（`resolve` 后）只保留一行：再次打开时更新 `opened_at`，不堆重复行。最多展示 / 同步 15 条，按 `opened_at` 倒序。

### 2.2 写入

打开、保存、`rememberOpened`（含文件关联）共用一条写入路径：

1. `resolve` 后 upsert `recent_files`
2. 加入本会话 allowlist
3. `app.addRecentDocument(path)`；抛错只记日志，不回滚数据库

### 2.3 启动

`openDatabase()` 之后、创建主窗之前：

1. 删除磁盘上不存在的 `path`
2. `app.clearRecentDocuments()`，再对仍有效的最多 15 条按倒序 `addRecentDocument`
3. 若 `win32`，刷新 Jump List：一项 `type: 'recent'`，再加自定义分类「最近文件」（只含仍存在的路径）

### 2.4 移除

- 移除一条：删 SQLite 行，allowlist 去掉该 path，然后清空系统最近并按剩余行重建，再刷 Jump List。
- 清空：删全部行、清空 allowlist 中这些 path、`clearRecentDocuments`、刷 Jump List。
- 点最近项时若文件已不在：删行、返回 `E_NOT_FOUND`、重建系统最近。

### 2.5 打开最近项与路径监禁

用户从**本应用最近列表或命令面板**点开，视为明确授权：将该 path 加入 allowlist 再读盘。不是「OS 最近列表里有就能任意读」。超过 2 MB 只返回 path，不读正文（与现有打开逻辑一致）。

### 2.6 IPC

已有 `files:add-recent` 保留。新增：

| 通道 | 参数 | 成功结果 |
| --- | --- | --- |
| `files:recent` | 无 | `RecentFile[]`（最多 15，已过滤不存在的可不在此返回；也可返回后由渲染标失效，主进程启动已清过，列表接口再 `existsSync` 一遍，不存在的不返回） |
| `files:open-recent` | `path: string` | 与 `files:open` 成功时相同：`{ path, content? }` |
| `files:forget` | `path?: string` | `null`。省略 `path` 表示清空 |

错误：`E_NOT_FOUND`（路径或行不存在）、`E_PATH`（非法 path 字符串）、`E_VALIDATION`。

渲染只走 `window.api.invoke`。

### 2.7 UI

- **文件页**：最近列表（路径、打开时间）。操作：打开、显示位置、从列表移除。空状态：「还没有最近文件」。
- **命令面板**：模块路由 + 最近文件（keyword 匹配 path）。选文件则 `router.push('/workbench/files')` 并 `files:open-recent`。分组标题「最近文件」。
- 不新开搜索窗口。

## 3. 主题、电源、开机自启、日志

### 3.1 主题

设置页改主题调用 `system:set-theme`，不再只 `conf:set`。`system:set-theme` 继续写 `nativeTheme.themeSource` 与 conf。

主进程 `nativeTheme.on('updated')` → 主窗 `webContents.send('theme:changed', { theme })`。`theme` 取当前 `nativeTheme.themeSource`（`system` / `light` / `dark`）。

渲染 bootstrap 订阅：写入 `store.settings.appearance.theme`。`AppLayout` 现有深浅色计算不用改算法。

### 3.2 电源

`powerMonitor.on('on-ac' | 'on-battery')` → `power:changed` `{ onBattery }`。系统页订阅并更新展示。`system:get-power` 保留（含 `idleState`）。

### 3.3 开机自启

设置「通用」增加开关，调用 `system:set-login`。与系统能力页共用 `settings.behavior.openAtLogin`。失败 `E_PLATFORM`，开关回弹。

### 3.4 日志

`userData/logs/main-YYYY-MM-DD.log`（本地日历日）。保留 `maxSize` 1 MB 作为单文件上限。不上传、不新做日志查看器。

## 4. 错误处理与测试

- 未知 `files:*` 参数：`E_VALIDATION`。
- 最近项打开失败：toast 现有 `invokeIpc` 错误信息。
- 单测（不加载 Electron 窗口）：
  - 日志文件名格式
  - 失效路径过滤
  - 同 path 去重后只留最新、截断 15 条
  - `files:forget` 重建列表的纯函数（输入剩余 path，输出应再 `addRecentDocument` 的顺序）
- `pnpm test` 与 `pnpm typecheck` 保持绿。

## 5. 文件与改动范围

新增或修改（计划阶段可微调路径，通道名以第 2.6 节为准）：

- `src/shared/ipc.ts`：三条 invoke
- `src/main/services/files.ts`、`recent-sync.ts`（或同等纯函数模块）
- `src/main/ipc/files.ts`、`src/main/index.ts`、`src/main/ipc/system.ts`、`src/main/services/logger.ts`
- `src/main/platforms/win.ts`（Jump List 增加 `type: 'recent'`）
- `src/renderer/src/views/FilesView.vue`、`CommandPalette.vue`、`SettingsView.vue`、`SystemView.vue`、`stores/app.ts`
- `tests/` 对应纯函数测试

不改 preload 的暴露方式。不改迷你浏览器 Session。
