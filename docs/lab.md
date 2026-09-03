# 实验室手册

实验室页的结构一样：说明、演示按钮、要点、安全注意。点按钮只走 `lab:run`，结果是一段 `message`，并写入 `lab_events`。

完整业务操作（保存笔记、下载文件、查找网页）在工作台或迷你浏览器，不在这些按钮里重复做一遍。

部分模块另有独立界面（深链、网络、平台、进阶、性能）。侧栏进对应路由即可。

## 怎么用

1. 先读本页「要点」和「安全注意」。
2. 点演示。失败时只 toast `error.message`，没有堆栈。
3. 平台没有的能力会返回 `E_PLATFORM`，按钮仍在，不会假装成功。
4. 到 **进程与性能** 或设置里导出的库，可以核对 `lab_events`。

危险按钮标了 `danger`，目前只有开发态「触发主进程演示异常」。

## 模块

### 进程与安全 `/lab/security`

对照主进程、preload、渲染进程。渲染进程视为不可信。

| 按钮               | 你会看到                                             |
| ------------------ | ---------------------------------------------------- |
| 查看应用与沙箱信息 | 版本、是否正式包、平台、沙箱相关信息                 |
| 查看安全状态       | enableSandbox、displayMedia 拒绝、设备权限拒绝等摘要 |

页内还有对照表，对应 `src/shared/security-checklist.ts` 的 11 行。

### 窗口与视图 `/lab/window`

子窗口只能由主进程建。按钮「创建子窗口」会开一扇与主窗同样沙箱设置的子窗。父窗关时子窗一起销毁。

更完整的进度条、全屏、浮窗在 **窗口中心**。

### 系统与桌面 `/lab/desktop`

「发送系统通知」。点击通知可按路由回到指定页。主题、电源、开机自启的完整控件在 **工作台 → 系统能力**。

不要在渲染进程里 `new Notification` 当正式能力。

### 文件与网络 `/lab/files`

「查看数据库状态」：库是否打开、路径（开发态带 `-dev`）。

打开 / 保存 / 最近文件在 **工作台 → 文件与拖放**。路径必须落在允许的根目录内。

### 媒体与捕获 `/lab/media`

「统计捕获源」只返回数量。选源、出缩略图、保存到磁盘在 **工作台 → 截图与桌面捕获**。

页面级 `getDisplayMedia` 会被 Session 拒绝。

### 原生 UI `/lab/native-ui`

「查看当前平台」。Jump List、Dock、TouchBar 在 **平台集成**。没有的能力不要点了当成功。

### 深链与文件关联 `/lab/protocol`

独立界面。协议名 `electron-lab://`，笔记形如 `electron-lab://note/12`。

- 注册后，二次启动走单实例，URL 交给已有窗口。
- macOS 开发态：`open "electron-lab://note/1"`。
- 安装包后，双击 `.md`：进最近文件；不超过 2MB 可建成笔记。

只处理校验过的 URL。

### 网络拦截与代理 `/lab/network`

独立界面。过滤、代理、（仅开发态）不安全证书，都只打在 `persist:browser`。

主界面不受影响。正式包不能关证书校验。

### 平台集成 `/lab/platform`

| 按钮           | 平台                |
| -------------- | ------------------- |
| 刷新 Jump List | Windows             |
| 刷新 Dock 菜单 | macOS               |
| 设置 TouchBar  | 带 Touch Bar 的 Mac |

非本平台返回 `E_PLATFORM`。最近文件只收录库里还存在的路径。

### 安全存储 `/lab/safe-storage`

「探测系统加密」即 `safeStorage.isEncryptionAvailable()`。加密笔记的开关在笔记页。密钥只在主进程。

### 进程与性能 `/lab/metrics`

完整表格在同一路由的性能页（`metrics:get`）。

| 按钮             | 你会看到                                                                  |
| ---------------- | ------------------------------------------------------------------------- |
| 刷新进程摘要     | CPU / 内存摘要                                                            |
| 查看最近进程事件 | `render-process-gone` / `child-process-gone` 文案；没有则「暂无进程事件」 |

事件在 SQL 里按 `module = 'process'` 取，不是先拉 50 条再滤。

### 进阶 `/lab/advanced`

独立界面，含更新 mock。

| 按钮                     | 说明                                                           |
| ------------------------ | -------------------------------------------------------------- |
| 运行 utilityProcess 导出 | 独立进程做字符串处理，避免堵住主进程                           |
| 查看崩溃转储目录         | crashReporter 只在正式包启动，且不上传                         |
| 触发主进程演示异常       | **仅开发态**。正式包禁用。不要在生产环境调用 `process.crash()` |

更新五态：`checking` / `available` / `downloading` / `downloaded` / `error`。开发态用 mock；正式包检查 GitHub Releases。

## 和 IPC 的关系

演示统一：

```ts
window.api.invoke('lab:run', module, action)
window.api.invoke('lab:events')
```

不要新开通道去「方便一下实验室」。工作台自己的通道（`notes:*`、`browser:find` 等）不在本手册展开，见源码 `src/shared/ipc.ts`。

错误码稳定为：`E_VALIDATION`、`E_PATH`、`E_NOT_FOUND`、`E_ENCRYPT`、`E_NETWORK`、`E_UPDATE`、`E_PLATFORM`。
