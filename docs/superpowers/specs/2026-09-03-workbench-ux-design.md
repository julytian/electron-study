# Electron Lab 工作台体验（C 期）

日期：2026-09-03
状态：待实现
仓库：`electron-study`
前序：`docs/superpowers/specs/2026-09-03-electron-lab-design.md`、`docs/superpowers/specs/2026-09-03-spec-closeout-design.md`

## 1. 背景与目标

A 期已收口最近文件与系统镜像。笔记、剪贴板、文件三个工作台页仍偏「能用」：笔记脏状态只给更新安装用，界面上看不出来，切走也不问；剪贴板历史只能看，不能写回或删单条；文件改了正文没有未保存提示。

本期只做每页最痛的 1–2 点，不加实验室页。

成功标准：

- 笔记改过能看到「未保存」；切到另一条、新建、离开笔记页时出现「保存 / 丢弃 / 取消」。
- 文件正文相对上次打开或保存有改动时标「未保存」；打开、打开最近、离开文件页时同一套三按钮。点工具栏「保存」不先弹确认。
- 点剪贴板历史能写回系统剪贴板，且历史不因此多一行；能删单条。
- 关主窗、藏到托盘不拦未保存。

非目标：

- 自动保存。
- 关窗 / `before-quit` / 藏托盘拦截。
- 更新安装仍只看现有 `notesDirty`，不扩到文件脏状态。
- 剪贴板图片预览、`v-html` 展示 HTML。
- 新实验室 API 页（B 期）。
- Playwright e2e。
- 给渲染进程 Node 或新的 preload 形态；只追加 2 个 invoke 通道。

## 2. 架构

共享确认与业务脏状态分开：

- `useUnsavedPrompt`：只弹层，返回 `save` | `discard` | `cancel`。
- `useNotes` / `useFiles`：各自算 dirty，决定何时问、保存或丢弃后怎么恢复。
- 剪贴板：主进程两条新通道，渲染只 `invokeIpc`。

关窗逻辑不改。侧栏和命令面板走 Vue Router，离开页靠 `onBeforeRouteLeave`。同一页内切条目（笔记 `?id=`、文件最近列表）由 composable 自己问。

## 3. 未保存确认

弹层用 ant-design-vue `Modal`，自定义页脚三个按钮。标题或正文：「有未保存的更改」。

| 选择 | 含义 |
| --- | --- |
| 保存 | 先走现有保存 IPC；成功后再继续原操作 |
| 丢弃 | 不写库，把编辑区恢复为干净快照，再继续 |
| 取消 | 中止原操作 |

文件另存对话框若取消，视为本次确认的「取消」：不切走、不打开新文件。

**删除笔记不走三按钮。**「保存再删」没有意义。未保存时文案写明会丢掉未保存改动，按钮是「删除 / 取消」。

## 4. 笔记

继续用现有快照（`id`、`title`、`body`、`pinned`、`isEncrypted`）。`store.notesDirty` 保持，关于页更新安装逻辑不动。

界面：当前标题旁「未保存」；有脏改动时「保存」用主按钮样式。

要问的时机：

- `open` 另一条（含路由 `?id=` 已在笔记页）
- `create`
- `onBeforeRouteLeave`

选「丢弃」：对当前 id 再 `notes:get`，或清空未保存字段回到干净快照。选「保存」：现有 `notes:update`。

## 5. 文件

对「上次打开或保存成功后的正文」做快照。超过 2MB 未读正文则不能改正文，不算脏。

界面：当前路径旁「未保存」。

要问的时机：`open`、`openRecent`、`onBeforeRouteLeave`。工具栏「保存」直接 `files:save`。

选「丢弃」：`content` 回到快照。打开成功或保存成功后更新快照并清脏。

`trash` / `forget` 不问未保存。回收站和最近列表针对的是磁盘路径，不是这份未保存正文；未保存只在离开页或打开另一文件时处理。

## 6. 剪贴板 IPC

已有 `clipboard:read` / `write` / `history` / `clear-history` 保留。`clipboard:write` 会再插入历史，点历史写回不能走它。

新增：

| 通道 | 参数 | 成功结果 |
| --- | --- | --- |
| `clipboard:restore` | `id: number` | `null` |
| `clipboard:delete` | `id: number` | `null` |

`restore`：按行写回系统剪贴板，**不**再 `INSERT` 历史。

- `text`：`writeText`
- `html`：`writeHTML`；若有 `text` 也 `writeText`
- `image`：主进程读 `image_path`，路径必须在 `clipboardDir` 内，再 `clipboard.writeImage`

`delete`：删该行。有图片且路径在 `clipboardDir` 内则删文件。行不存在 → `E_NOT_FOUND`。图片文件已不在：仍删表行，不因此失败。

错误：

- 非法 id → `E_VALIDATION`
- 行不存在 → `E_NOT_FOUND`
- 图片路径越狱 → `E_PATH`；文件不存在或读失败 → `E_NOT_FOUND`

渲染只 `window.api.invoke`。错误走现有 `invokeIpc` toast。

`SystemClipboard` 测试桩补 `writeImage`。生产实现用 Electron `clipboard.writeImage`。

## 7. 剪贴板界面

- 点标题或正文：`clipboard:restore`，成功 toast「已写回剪贴板」
- 「删除」：`clipboard:delete`，不再确认。清空历史仍走现有按钮
- 图片：只显示文件名，不预览、不 `v-html`

## 8. 测试

主进程 Vitest：

- `restore` 文本 / HTML：系统剪贴板变化，历史条数不变
- `restore` 图片：调用注入的 `writeImage`，历史条数不变
- `restore` 不存在的 id → `E_NOT_FOUND`；图片路径不在 `clipboardDir` → `E_PATH`
- `delete` 文本行后表中无该 id；`delete` 图片行后库行和文件都消失；再删 → `E_NOT_FOUND`
- 笔记 / 文件脏判断抽成纯函数（若尚未独立）：改了为脏，与快照相同为干净。不测 Modal 点击

不测：Playwright、关窗、渲染弹层集成。

手验：

1. 改笔记标题，出现「未保存」；切另一条：保存后进去、丢弃后还原、取消则仍在原条
2. 改文件正文后打开或点最近文件，三按钮同上；点「保存」不先弹确认
3. 点历史写回后系统能贴出，列表不增一行；删单条后该项消失
4. 关窗不弹未保存

## 9. 文件地图

```
src/shared/ipc.ts
src/main/services/clipboard.ts
src/main/ipc/clipboard.ts
src/renderer/src/composables/useUnsavedPrompt.ts
src/renderer/src/composables/useNotes.ts
src/renderer/src/composables/useFiles.ts
src/renderer/src/views/NotesView.vue
src/renderer/src/views/FilesView.vue
src/renderer/src/views/ClipboardView.vue
tests/clipboard.test.ts
tests/unsaved-snapshot.test.ts
```
