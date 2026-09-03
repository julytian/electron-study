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

默认 `sandbox`、`contextIsolation`，渲染进程关闭 `nodeIntegration`。页面只能走白名单 IPC。开发态的 `userData` 目录带 `-dev` 后缀，避免和正式包装在一起。忽略 CVE-2026-56876（extract-zip 经 electron 引入，尚无修复版本）。

## 协议

深链形如 `electron-lab://note/:id`，由主进程校验后再打开对应笔记。

## 许可证

MIT。见 [LICENSE](LICENSE)。
