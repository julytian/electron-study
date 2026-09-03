# Electron Lab 规格 A：加固收口与工作台边角

日期：2026-09-03
状态：待实现
仓库：`julytian/electron-lab`（本地目录仍可能叫 `electron-study`）
前序：`docs/superpowers/specs/2026-09-03-hardening-followup-design.md`

总路线是 A → B → C。本期只做 A。B（发布闭环 + CI）和 C（实验室加深）另写规格，不混进本期实现。

## 1. 背景与目标

加固跟进已落地：主窗 `render-process-gone` 可 reload、gone 事件进 `lab_events`、preload 不再用 `*` 做 `postMessage`。终审留下 4 条 Minor，工作台还缺两处小能力：系统在线状态、迷你浏览器页内查找。

成功标准：

- `createMainWindow` 之后连续 reload 计数为 0，并为该窗重新挂上 `did-finish-load` 清零。
- `child-process-gone` 同时写入 `lab_events` 和主进程 `log.warn`。
- `lab:run('metrics', 'recent-gone')` 只看到 `module = 'process'` 的行。
- preload 收到 `message` 时，没有 `ports[0]` 则忽略，不抛错。
- 系统页能显示在线 / 离线；`system:get-power` 与 `power:changed` 都带 `online`。
- 迷你浏览器工具栏能按关键字查找上一个 / 下一个，界面显示「第 n / 共 m」。

非目标：

- `browser:found` 推送通道、Esc 完整查找条、查找高亮样式定制。
- 笔记导入导出、底栏全局在线指示。
- 实验室 B 期、发布闭环、CI 多平台、Dependabot、Playwright。
- 真断网探测轮询、真代码签名、禁用 `openDevTools`。
- 新开 event 通道。invoke 只允许新增 `browser:find`。

## 2. 架构

继续拆纯函数与挂载函数。纯函数放 `src/shared/`，挂载失败只记日志，不 `app.quit()`。

| 单元 | 职责 |
| --- | --- |
| `notifyMainWindowCreated()` | 连续 reload 计数清零，给当前主窗挂 `did-finish-load` |
| `listProcessLabEvents(limit)` | SQL 直接取 `module = 'process'` 的最近事件 |
| `shouldAcceptLabPortMessage(data, portsLength)` | 判断 preload 是否接受这条 port 消息 |
| `powerSnapshot()` | `{ onBattery, idleState, online }` |
| `parseFindInPageRequest(query, action)` | 校验查找参数，产出 `findInPage` / `stopFindInPage` 指令 |
| `browser:find` | 对迷你浏览器 `WebContentsView` 执行查找，等 `finalUpdate` 再回 |

`attachProcessRecovery()` 仍在 `whenReady`、数据库已开之后调用。它不再依赖「attach 时主窗已存在」。

`createMainWindow` 与 `process-recovery` 若形成循环引用：`main.ts` 只在函数体末尾调用 `notifyMainWindowCreated()`，不要在模块顶层读 recovery 的可变状态。

## 3. 加固收口

### 3.1 主窗重建重置计数

模块级 `consecutiveReloads` 在新主窗诞生时必须归零。`loadHookedId` 按新 `webContents.id` 重新挂钩；旧窗的 listener 随销毁消失，不必手动摘。

调用点：`createMainWindow` 末尾，`loadMainWindow` 之后。所有创建路径（首次 `whenReady`、`activate`、`toggleMainWindow` 在窗为 null 时）都走这里，不在 `index.ts` 再散落调用。

`did-finish-load` 仍把 `consecutiveReloads` 置 0。`render-process-gone` 时只调用 `hookMainLoadReset()`（按当前主窗 id 挂钩），**不要**走 `notifyMainWindowCreated()`，否则计数被清零，连续 reload 上限会失效。计数归零只发生在：新主窗创建、或本次 load 成功。

### 3.2 子进程 gone 写日志

`child-process-gone` 保持现有 `recordLabEvent('process', 'child-process-gone', false, message)`。额外 `log.warn(message)`，`message` 仍用 `formatChildProcessGoneMessage`。不 `app.quit()`，不重建子进程。

`render-process-gone` 不强制加日志；已有 `lab_events`。若顺手加 `log.warn` 可以，不是验收项。

### 3.3 recent-gone 走 SQL

新增（或改现有查询）：

```sql
SELECT * FROM lab_events
WHERE module = 'process'
ORDER BY created_at DESC
LIMIT ?
```

`recentProcessEventsMessage(limit = 10)` 用这条查询，`LIMIT` 就是 `limit`，不要先取 50 再在内存里滤。

`formatRecentProcessEvents` 可继续防御性过滤 `module === 'process'`。空列表文案仍是「暂无进程事件」。

### 3.4 preload 的 ports[0]

`shouldAcceptLabPortMessage(data, portsLength)`：

- `data === 'port'` 且 `portsLength > 0` → `true`
- 其它 → `false`

preload 的 `window` `message` 监听：先 `isTrustedPortMessageOrigin`，再 `shouldAcceptLabPortMessage(event.data, event.ports.length)`，不通过则 `return`。不要访问可能是 `undefined` 的 `event.ports[0]`。

`ipcRenderer.on('port')` 已有 `event.ports.length === 0` 判断，保持。

## 4. 在线状态

不新开通道。`net.isOnline()` 是唯一数据源。

`system:get-power` 成功结果：

```ts
{ onBattery: boolean; idleState: string; online: boolean }
```

`power:changed` 载荷：

```ts
{ onBattery: boolean; online: boolean }
```

推送时机：现有 `on-ac` / `on-battery`，再加上 `powerMonitor` 的 `resume`（唤醒后网络常变）。不设定时轮询。Electron 的 `net` 若无可靠 online 事件，就不挂。

系统页：

- 进入页面或点「读电源」时拉 `system:get-power`，展示「网络：在线 / 离线」。
- store 增加 `online: boolean | null`，订阅 `power:changed` 更新，展示优先级与电池字段相同：store 有值用 store，否则用本次读取。

不进底栏，不进 `app:get-info`。

## 5. 迷你浏览器查找

新增 invoke，不新增 event：

| 通道 | 参数 | 成功结果 |
| --- | --- | --- |
| `browser:find` | `query: string`，`action: 'next' \| 'previous' \| 'stop'` | `{ activeMatchOrdinal: number; matches: number }` |

`parseFindInPageRequest`：

| 输入 | 结果 |
| --- | --- |
| `action` 不是三选一 | `E_VALIDATION`，「查找动作无效」 |
| `query` 不是字符串 | `E_VALIDATION`，「查找关键字无效」 |
| `action === 'stop'` | 指令 `stop`（清空输入时用，不校验关键字是否为空） |
| `next` / `previous` 且 `query.trim() === ''` | `E_VALIDATION`，「查找关键字不能为空」 |
| `next` | `{ forward: true, findNext: true }` |
| `previous` | `{ forward: false, findNext: true }` |

主进程：

- 没有 `browserView` 或 `webContents` 已销毁 → `E_VALIDATION`，「浏览器尚未创建」（与 `browser:go` 一致）。
- `stop`：`stopFindInPage('clearSelection')`，立即返回 `{ activeMatchOrdinal: 0, matches: 0 }`。
- `next` / `previous`：`findInPage(query, options)`，等待该 `webContents` 下一次 `found-in-page` 且 `result.finalUpdate === true`，返回 `{ activeMatchOrdinal, matches }`。2 秒内没有 `finalUpdate` → 仍成功返回 `{ activeMatchOrdinal: 0, matches: 0 }`，不报错。
- 等待期间再次 `browser:find`：取消上一次等待（视为 0/0），只认最新一次。

界面（`BrowserView.vue`）：

- 地址栏旁或下一行：输入框、「上一个」、「下一个」、文案 `n / m`（即 `activeMatchOrdinal / matches`）。
- 回车 = 下一个。清空输入并失焦或清空后点查找 = `stop`，显示 `0 / 0`。
- 离开 `/browser` 时 view 会卸，查找状态丢弃，不持久化。

不把查找加进实验室 catalog。那是规格 C。

## 6. 错误处理

形状不变：`{ ok: true, data } | { ok: false, error: { code, message } }`。

| 场景 | 错误码 |
| --- | --- |
| 查找动作 / 关键字非法、关键字为空、浏览器未创建 | `E_VALIDATION` |
| 在线状态读失败 | 不单独报错；`net.isOnline()` 失败则 `online: false` |
| 查找超时或无匹配 | 成功，`0 / 0` |

渲染进程继续只 toast `error.message`。`0 / 0` 不当错误、不 toast。

## 7. 测试

Vitest 纯函数 / 服务：

- `shouldAcceptLabPortMessage`：`port` + 有 port 通过；`port` + 0 个 port、错误 data 拒绝。
- `formatRecentProcessEvents` / `recentProcessEventsMessage`：空列表；插入 process 与非 process 后，文案不含非 process 行。
- `parseFindInPageRequest`：空关键字、非法 action、stop、next、previous。
- `powerSnapshot` 若可注入 `isOnline`：在线 / 离线各一条。

不测：真崩溃重载实机、真断网、查找高亮像素、Modal、Playwright。

手验：

1. 开发态打开系统页，能看到在线状态；点「读电源」会刷新。
2. 迷你浏览器打开任意页，输入可见单词，下一个能看到 `n / m` 变化；上一个能回退。
3. 清空查找框后计数回到 `0 / 0`。
4. 未开迷你浏览器时（或 view 已卸）查找应 toast「浏览器尚未创建」——以实机为准；从本页操作时 view 应已创建。

## 8. 文件地图

```
src/shared/ipc.ts
src/shared/port-origin.ts
src/shared/lab-event-format.ts
src/shared/find-in-page.ts
src/shared/power-status.ts
src/main/services/process-recovery.ts
src/main/services/lab-events.ts
src/main/windows/main.ts
src/main/ipc/system.ts
src/main/ipc/browser.ts
src/preload/index.ts
src/renderer/src/stores/app.ts
src/renderer/src/views/SystemView.vue
src/renderer/src/views/BrowserView.vue
tests/port-origin.test.ts
tests/find-in-page.test.ts
tests/lab-events-process.test.ts
```

`lab-events-process.test.ts` 若必须起真实 SQLite，沿用现有测试库夹具；否则只测 `formatRecentProcessEvents` 的过滤与截断。
