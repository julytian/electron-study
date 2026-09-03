# 上手教程

四条短路径，按顺序做即可。每条都能独立重做。

更细的页面说明见 [使用指南](guide.md)，实验室每一页见 [实验室手册](lab.md)。

## 准备

- Node.js 22
- pnpm 11（仓库用 pnpm；CI 也是 11）
- 能访问 GitHub（克隆、以后检查更新）

```bash
git clone https://github.com/julytian/electron-lab.git
cd electron-lab
pnpm install
pnpm dev
```

首次会编译 `better-sqlite3` 等原生模块。窗口起来后，默认进「本地笔记」。

检查（可选）：

```bash
pnpm test
pnpm typecheck
pnpm lint
```

## 教程 1：写一条加密笔记

1. 侧栏打开 **工作台 → 本地笔记**。
2. 点「新建」，标题写 `教程`，正文写一句任意可见的词，例如 `hello-lab`。
3. 打开加密开关（若系统探测不到 `safeStorage`，页面会说明，可先不加密）。
4. 点保存。侧栏再搜 `教程`，应能找到。
5. 改一个字，标题旁出现「未保存」。点侧栏「剪贴板工作台」：应弹出「保存 / 丢弃 / 取消」。选保存，再回来，改动还在。

你在学什么：业务数据在主进程 SQLite；加密密钥不进渲染进程；未保存只拦路由切换，不拦关窗。

## 教程 2：用深链打开这条笔记

1. 看笔记 URL 或列表，记住数字 id（例如 `1`）。
2. 打开 **设置** 或 **实验室 → 深链与文件关联**，点「注册 electron-lab://」，确认对话框。
3. macOS 开发态在终端执行：

   ```bash
   open "electron-lab://note/1"
   ```

   把 `1` 换成你的 id。已打开的实例应跳到该笔记。第二次执行不会再起一个进程（单实例）。

4. 安装正式包后，可再试：用系统打开一个不超过 2MB 的 `.md` 文件，应进入最近文件，并可能建成一条笔记。

你在学什么：自定义协议由主进程解析；非法 URL 不会被路由；二次启动把参数交给现有窗口。

## 教程 3：迷你浏览器查找与 Session 隔离

1. 打开 **浏览 → 迷你浏览器**。地址栏输入 `example.com`，前往。
2. 在查找框输入页面上看得见的词（例如 `Example`），回车或点「下一个」。右侧应变为 `1 / n` 这类计数。点「上一个」应回退。
3. 清空查找框，计数回到 `0 / 0`。
4. 打开 **实验室 → 网络拦截与代理**，打开过滤或设一条代理（可先只开过滤看说明）。回到迷你浏览器再导航一次。
5. 主界面（笔记、设置）不应受这条代理 / 过滤影响。

你在学什么：迷你浏览器用 `persist:browser`；下载、拦截、证书策略打在这个分区；主窗口仍走默认 Session。页内查找走 `browser:find`，不是页面自己的 `window.find`。

## 教程 4：看安全对照表和进程事件

1. 打开 **实验室 → 进程与安全**。
2. 点「查看应用与沙箱信息」，确认开发态、沙箱相关字段说得通。
3. 点「查看安全状态」，应能看到 enableSandbox、displayMedia 拒绝、设备权限拒绝等摘要。
4. 同一页下方有对照表（沙箱、隔离、无 Node、CSP、Fuses、崩溃恢复等），每一行对应仓库里的一个文件。
5. 打开 **实验室 → 进程与性能**，点「刷新进程摘要」，再点「查看最近进程事件」。若还没有崩溃过，文案是「暂无进程事件」。

不要在正式包里点「进阶」里的「触发主进程演示异常」。那只在开发态演示，生产禁用。

你在学什么：渲染进程不可信；安全策略集中在主进程 Session 与窗口偏好；崩溃事件进 `lab_events`，可用 SQL 按 `module = process` 查询。

## 教程 5：打一份本机包（可选）

未签名，仅供自己装。

```bash
# macOS
CSC_IDENTITY_AUTO_DISCOVERY=false pnpm build:mac

# Linux AppImage（不要默认打 snap）
CSC_IDENTITY_AUTO_DISCOVERY=false pnpm exec electron-builder --linux AppImage --publish never
```

产物在 `dist/`。正式包的 `userData` 没有 `-dev`，和 `pnpm dev` 的数据是两套。

关于页在正式包里才会向 GitHub Releases 做真检查。开发态点「检查更新」走 mock 五态（检查中 → 有版本 → 下载 → 完成 / 错误），完整按钮也在 **实验室 → 进阶**。

## 做完之后

- 日常功能：继续看 [使用指南](guide.md)
- 每个实验室按钮：看 [实验室手册](lab.md)
- 设计决策与 IPC 形状：`docs/superpowers/specs/`（给实现用，不是用户手册）
