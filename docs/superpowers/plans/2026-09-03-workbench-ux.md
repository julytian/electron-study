# 工作台体验 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 笔记和文件标未保存并在切走时「保存 / 丢弃 / 取消」；剪贴板历史可写回系统、可删单条。

**Architecture:** 脏判断与守卫是可单测纯函数；Vue 只负责 Modal 和接线。剪贴板 `restore` / `delete` 在主进程，渲染只 `window.api.invoke`。关窗不拦。

**Tech Stack:** 现有 Electron Lab（electron-vite、Vue 3、ant-design-vue、Vitest）。不新加 npm 包。

**Spec:** `docs/superpowers/specs/2026-09-03-workbench-ux-design.md`

---

## File map

```
src/shared/unsaved.ts                         # 快照、isDirty、runUnsavedGuard
src/shared/ipc.ts                             # clipboard:restore / clipboard:delete
src/main/services/clipboard.ts                # restore / delete，SystemClipboard.writeImage
src/main/ipc/clipboard.ts                     # 适配器 + 两条 handle，wrap 映射 E_NOT_FOUND
src/renderer/src/composables/useUnsavedPrompt.ts
src/renderer/src/composables/useNotes.ts
src/renderer/src/composables/useFiles.ts
src/renderer/src/composables/useClipboard.ts
src/renderer/src/views/NotesView.vue
src/renderer/src/views/FilesView.vue
src/renderer/src/views/ClipboardView.vue
tests/unsaved.test.ts
tests/clipboard.test.ts
```

工作目录：仓库根 `/Users/julytian/Downloads/mianshi/electron-study`。提交用 HEREDOC，不要 `--no-verify`，不要 push（除非用户另说）。

新 BrowserWindow 必须 `sandbox: true`、`contextIsolation: true`、`nodeIntegration: false`。本期不新开窗口。通道名以 Task 2 为准，不要再加别的 invoke/event。

---

### Task 1: 未保存纯函数

**Files:**

- Create: `src/shared/unsaved.ts`
- Test: `tests/unsaved.test.ts`

- [ ] **Step 1: 写失败测试**

Create `tests/unsaved.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import {
  isDirtySnapshot,
  noteSnapshot,
  runUnsavedGuard,
  type UnsavedChoice
} from '../src/shared/unsaved'

describe('isDirtySnapshot', () => {
  it('is dirty when current differs from clean', () => {
    expect(isDirtySnapshot('a', 'b')).toBe(true)
    expect(isDirtySnapshot('a', 'a')).toBe(false)
    expect(isDirtySnapshot(null, 'a')).toBe(false)
  })
})

describe('noteSnapshot', () => {
  it('includes title body pin and encrypt', () => {
    const snap = noteSnapshot({
      id: 1,
      title: 't',
      body: 'b',
      pinned: true,
      isEncrypted: false,
      createdAt: 0,
      updatedAt: 0
    })
    expect(snap).toContain('"title":"t"')
    expect(isDirtySnapshot(noteSnapshot({
      id: 1,
      title: 't2',
      body: 'b',
      pinned: true,
      isEncrypted: false,
      createdAt: 0,
      updatedAt: 0
    }), snap)).toBe(true)
  })
})

describe('runUnsavedGuard', () => {
  it('skips the prompt when clean', async () => {
    const ask = vi.fn<[], Promise<UnsavedChoice>>()
    await expect(runUnsavedGuard({ dirty: false, ask, save: async () => true })).resolves.toBe(true)
    expect(ask).not.toHaveBeenCalled()
  })

  it('cancels, saves, or discards', async () => {
    await expect(
      runUnsavedGuard({ dirty: true, ask: async () => 'cancel', save: async () => true })
    ).resolves.toBe(false)
    await expect(
      runUnsavedGuard({ dirty: true, ask: async () => 'save', save: async () => true })
    ).resolves.toBe(true)
    await expect(
      runUnsavedGuard({ dirty: true, ask: async () => 'save', save: async () => false })
    ).resolves.toBe(false)
    await expect(
      runUnsavedGuard({ dirty: true, ask: async () => 'discard', save: async () => true })
    ).resolves.toBe(true)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm exec vitest run tests/unsaved.test.ts
```

Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现**

Create `src/shared/unsaved.ts`:

```ts
import type { Note } from './models'

export type UnsavedChoice = 'save' | 'discard' | 'cancel'

export function isDirtySnapshot(current: string | null, clean: string | null): boolean {
  if (current === null || clean === null) return false
  return current !== clean
}

export function noteSnapshot(note: Note | null): string | null {
  if (!note) return null
  return JSON.stringify({
    id: note.id,
    title: note.title,
    body: note.body,
    pinned: note.pinned,
    isEncrypted: note.isEncrypted
  })
}

export async function runUnsavedGuard(options: {
  dirty: boolean
  ask: () => Promise<UnsavedChoice>
  save: () => Promise<boolean>
}): Promise<boolean> {
  if (!options.dirty) return true
  const choice = await options.ask()
  if (choice === 'cancel') return false
  if (choice === 'save') return options.save()
  return true
}
```

- [ ] **Step 4: 测试通过**

```bash
pnpm exec vitest run tests/unsaved.test.ts
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/shared/unsaved.ts tests/unsaved.test.ts
git commit -m "$(cat <<'EOF'
feat: 抽取未保存快照与守卫纯函数

EOF
)"
```

---

### Task 2: 剪贴板 IPC 契约

**Files:**

- Modify: `src/shared/ipc.ts`

- [ ] **Step 1: 在 `clipboard:clear-history` 后增加**

```ts
  'clipboard:restore': true,
  'clipboard:delete': true,
```

`InvokeMap` 同步：

```ts
  'clipboard:restore': { args: [id: number]; result: null }
  'clipboard:delete': { args: [id: number]; result: null }
```

不要改 event 通道。不要改 preload 结构。

- [ ] **Step 2: typecheck**

```bash
pnpm typecheck
```

Expected: 通过。

- [ ] **Step 3: Commit**

```bash
git add src/shared/ipc.ts
git commit -m "$(cat <<'EOF'
feat: 添加剪贴板写回与删除 IPC 通道

EOF
)"
```

---

### Task 3: 剪贴板 restore / delete

**Files:**

- Modify: `src/main/services/clipboard.ts`
- Modify: `tests/clipboard.test.ts`

- [ ] **Step 1: 扩展测试桩并写失败用例**

`SystemClipboard` 增加 `writeImage(png: Buffer): void`。`stubClipboard` 增加：

```ts
    writeImage: (png: Buffer) => {
      state.image = pngImage(png)
    }
```

并在返回对象上暴露 `writtenImage`（或读 `clipboard.image.toPNG()`）供断言。

在 `tests/clipboard.test.ts` 追加：

1. `write` 一条文本后 `restore(id)`：系统 text 变为该内容，`history().length` 仍为 1。
2. `write` HTML 后 `restore`：html + text 写回，条数不变。
3. `read` 一张图后 `restore`：`writeImage` 被调用且 bytes 相同，条数不变。
4. `restore(999)` 抛 `name: 'E_NOT_FOUND'`。
5. 手工插入 `image_path` 为 `tmpdir` 外路径的行，`restore` 抛 `name: 'E_PATH'`。
6. `delete` 文本行后 history 为空。
7. `delete` 图片行后文件不存在；再 `delete` 同一 id 抛 `E_NOT_FOUND`。
8. 图片文件已删，`delete` 仍去掉表行且不抛。

先跑：`pnpm exec vitest run tests/clipboard.test.ts` —— 新用例 FAIL。

- [ ] **Step 2: 实现**

`SystemClipboard`：

```ts
export interface SystemClipboard {
  readText(): string
  readHTML(): string
  readImage(): NativeImageLike
  writeText(text: string): void
  writeHTML(html: string): void
  writeImage(png: Buffer): void
}
```

`ClipboardService` 增加：

```ts
  restore(id: number): void
  delete(id: number): void
```

实现要点：

- 查 `SELECT * FROM clipboard_items WHERE id = ?`，没有则 `Object.assign(new Error('E_NOT_FOUND: Clipboard item is missing'), { name: 'E_NOT_FOUND' })`。
- `restore` text：`system.writeText(row.text || '')`。html：`writeHTML`，若有 text 再 `writeText`。image：`assertWithinRoot(image_path, clipboardDir)`，不存在则 `E_NOT_FOUND`，否则 `readFileSync` + `system.writeImage`。
- `restore` **禁止**再 `INSERT`。
- `delete`：先读行；有 `image_path` 且 `assertWithinRoot` 成功则 `unlinkSync`（文件不在则忽略）；再 `DELETE WHERE id = ?`。行不存在抛 `E_NOT_FOUND`。
- 非法 id（非正整数）抛 `name: 'E_VALIDATION'`。

- [ ] **Step 3: 测试通过**

```bash
pnpm exec vitest run tests/clipboard.test.ts
```

Expected: PASS。

- [ ] **Step 4: Commit**

```bash
git add src/main/services/clipboard.ts tests/clipboard.test.ts
git commit -m "$(cat <<'EOF'
feat: 剪贴板支持按条写回与删除

EOF
)"
```

---

### Task 4: 剪贴板 IPC 接线

**Files:**

- Modify: `src/main/ipc/clipboard.ts`

- [ ] **Step 1: 适配 Electron clipboard**

不要把 Electron `clipboard` 整对象再当 `SystemClipboard`（缺 `writeImage(png: Buffer)`）。改为：

```ts
import { clipboard, ipcMain, nativeImage } from 'electron'

function systemClipboard(): SystemClipboard {
  return {
    readText: () => clipboard.readText(),
    readHTML: () => clipboard.readHTML(),
    readImage: () => clipboard.readImage(),
    writeText: (text) => clipboard.writeText(text),
    writeHTML: (html) => clipboard.writeHTML(html),
    writeImage: (png) => clipboard.writeImage(nativeImage.createFromBuffer(png))
  }
}
```

`wrap` 增加：`name === 'E_NOT_FOUND'` → `errorCodes.NOT_FOUND`。

注册：

```ts
  ipcMain.handle('clipboard:restore', (_event, id: number) =>
    wrap(() => {
      service().restore(id)
      return null
    })
  )
  ipcMain.handle('clipboard:delete', (_event, id: number) =>
    wrap(() => {
      service().delete(id)
      return null
    })
  )
```

- [ ] **Step 2: typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/main/ipc/clipboard.ts
git commit -m "$(cat <<'EOF'
feat: 注册剪贴板写回与删除 IPC

EOF
)"
```

---

### Task 5: 未保存弹层 composable

**Files:**

- Create: `src/renderer/src/composables/useUnsavedPrompt.ts`

- [ ] **Step 1: 实现**

```ts
import { Modal } from 'ant-design-vue'
import { h } from 'vue'
import type { UnsavedChoice } from '@shared/unsaved'

export function askUnsaved(message = '有未保存的更改'): Promise<UnsavedChoice> {
  return new Promise((resolve) => {
    const modal = Modal.confirm({
      title: message,
      content: '保存后继续，或丢弃更改。',
      closable: true,
      keyboard: true,
      okButtonProps: { style: { display: 'none' } },
      cancelButtonProps: { style: { display: 'none' } },
      footer: () =>
        h('div', { style: 'display:flex;gap:8px;justify-content:flex-end' }, [
          h(
            'button',
            { class: 'ant-btn', onClick: () => { modal.destroy(); resolve('cancel') } },
            '取消'
          ),
          h(
            'button',
            { class: 'ant-btn', onClick: () => { modal.destroy(); resolve('discard') } },
            '丢弃'
          ),
          h(
            'button',
            {
              class: 'ant-btn ant-btn-primary',
              onClick: () => { modal.destroy(); resolve('save') }
            },
            '保存'
          )
        ])
    })
  })
}
```

若 ant-design-vue 4 的 `Modal.confirm` 对自定义 footer 不友好，改用 `Modal.confirm` 的 `okText` / `cancelText` 不够三个按钮时，改成：

```ts
import { Modal } from 'ant-design-vue'

export function askUnsaved(message = '有未保存的更改'): Promise<UnsavedChoice> {
  return new Promise((resolve) => {
    Modal.confirm({
      title: message,
      content: '保存后继续，或丢弃更改。',
      okText: '保存',
      cancelText: '取消',
      onOk: () => resolve('save'),
      onCancel: () => resolve('cancel'),
      // 第三个按钮：
      footer: undefined
    })
  })
}
```

**必须三个按钮。** 优先 `Modal` 函数调用 + 自定义 `footer` 渲染三个 `a-button`。可在实现时对照项目里已有 `Modal.confirm`（`SettingsView.vue`）。关遮罩 / 按 Esc 视为 `cancel`。

删除笔记用另一个函数，不要复用三按钮：

```ts
export function askDeleteNote(dirty: boolean): Promise<boolean> {
  return new Promise((resolve) => {
    Modal.confirm({
      title: dirty ? '删除这条笔记？未保存的更改会丢掉。' : '删除这条笔记？',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => resolve(true),
      onCancel: () => resolve(false)
    })
  })
}
```

- [ ] **Step 2: typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/composables/useUnsavedPrompt.ts
git commit -m "$(cat <<'EOF'
feat: 添加未保存三按钮与删除确认

EOF
)"
```

---

### Task 6: 笔记页接线

**Files:**

- Modify: `src/renderer/src/composables/useNotes.ts`
- Modify: `src/renderer/src/views/NotesView.vue`

- [ ] **Step 1: `useNotes` 用共享快照**

把本地 `noteSnapshot` 换成 `@shared/unsaved` 的 `noteSnapshot` + `isDirtySnapshot`。`syncDirty`：

```ts
  app.notesDirty = isDirtySnapshot(noteSnapshot(current.value), cleanSnapshot)
```

增加：

```ts
  async function confirmProceed(): Promise<boolean> {
    return runUnsavedGuard({
      dirty: app.notesDirty,
      ask: () => askUnsaved(),
      save: async () => {
        if (!current.value) return true
        await save()
        return true
      }
    })
  }
```

`open(id)`：若 `current.value?.id === id` 只刷新打开；否则先 `confirmProceed()`，false 则 return。`create` 同样先确认。

`remove` 不再自己确认（View 里问）。导出 `confirmProceed`。

选「丢弃」后若仍要 `open` / `create`：`confirmProceed` 返回 true 即可，调用方接着 `notes:get` / `notes:create`。丢弃不必先 `notes:get` 当前条，因为马上会被替换。

- [ ] **Step 2: `NotesView`**

```ts
import { onBeforeRouteLeave } from 'vue-router'
import { askDeleteNote } from '../composables/useUnsavedPrompt'

const { notes, current, keyword, refresh, open, create, save, remove, confirmProceed } = useNotes()

onBeforeRouteLeave(async (_to, _from, next) => {
  next((await confirmProceed()) ? undefined : false)
})

async function onRemove(): Promise<void> {
  if (!current.value) return
  const ok = await askDeleteNote(Boolean(/* store.notesDirty */))
  if (!ok) return
  await remove(current.value.id)
}
```

标题旁：

```vue
<a-form-item label="标题">
  <a-space>
    <a-input v-model:value="current.title" placeholder="标题" />
    <a-tag v-if="store.notesDirty" color="orange">未保存</a-tag>
  </a-space>
</a-form-item>
```

保存按钮：`:type="store.notesDirty ? 'primary' : 'default'"`。

无 `v-html`。无 Node。

- [ ] **Step 3: typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/composables/useNotes.ts src/renderer/src/views/NotesView.vue
git commit -m "$(cat <<'EOF'
feat: 笔记未保存提示与切走确认

EOF
)"
```

---

### Task 7: 文件页脏状态

**Files:**

- Modify: `src/renderer/src/composables/useFiles.ts`
- Modify: `src/renderer/src/views/FilesView.vue`

- [ ] **Step 1: `useFiles`**

```ts
  const cleanContent = ref<string | null>(null)
  const dirty = computed(
    () => contentLoaded.value && isDirtySnapshot(content.value, cleanContent.value)
  )

  function markClean(): void {
    cleanContent.value = contentLoaded.value ? content.value : null
  }
```

`open` / `openRecent` 成功写入 content 后 `markClean()`。`save` 成功后 `markClean()`。`trash` 后 `cleanContent = null`。

```ts
  async function confirmProceed(): Promise<boolean> {
    return runUnsavedGuard({
      dirty: dirty.value,
      ask: () => askUnsaved(),
      save: async () => {
        const before = path.value
        const beforeContent = content.value
        await save()
        return path.value !== null && (path.value !== before || content.value === beforeContent || dirty.value === false)
      }
    })
  }
```

保存对话框取消时 `files:save` 返回 `null`，`save()` 早退，`dirty` 仍为 true。`confirmProceed` 的 `save` 必须在这种情况下返回 `false`：

```ts
      save: async () => {
        const result = await invokeIpc('files:save', content.value)
        if (!result) return false
        path.value = result.path
        contentLoaded.value = true
        markClean()
        await refreshRecents()
        return true
      }
```

此时工具栏 `save()` 与守卫共用这段写入，避免两套逻辑。抽出 `persistSave(): Promise<boolean>`。

`open` / `openRecent` 开头：`if (!(await confirmProceed())) return`。

导出 `dirty`、`confirmProceed`。

- [ ] **Step 2: `FilesView`**

`onBeforeRouteLeave` 与笔记相同，走 `confirmProceed`。

路径旁：

```vue
<a-descriptions-item label="当前路径">
  {{ path || '尚未打开或保存文件' }}
  <a-tag v-if="dirty" color="orange">未保存</a-tag>
</a-descriptions-item>
```

`trash` / `forget` 不问未保存。

- [ ] **Step 3: typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/composables/useFiles.ts src/renderer/src/views/FilesView.vue
git commit -m "$(cat <<'EOF'
feat: 文件未保存提示与打开前确认

EOF
)"
```

---

### Task 8: 剪贴板页

**Files:**

- Modify: `src/renderer/src/composables/useClipboard.ts`
- Modify: `src/renderer/src/views/ClipboardView.vue`

- [ ] **Step 1: composable**

```ts
  async function restore(id: number): Promise<void> {
    await invokeIpc('clipboard:restore', id)
    message.success('已写回剪贴板')
  }

  async function remove(id: number): Promise<void> {
    await invokeIpc('clipboard:delete', id)
    await refresh()
  }
```

`message` 从 `ant-design-vue` 引入（与 `useIpc` 一致）。失败由 `invokeIpc` toast。`restore` 成功后不必 `refresh`（条数不变）。

- [ ] **Step 2: 视图**

每项标题/描述可点：`@click="restore(item.id)"`。actions 里「删除」：`@click.stop="remove(item.id)"`。图片仍只显示 `imageCaption`。无 `v-html`。

- [ ] **Step 3: typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/composables/useClipboard.ts src/renderer/src/views/ClipboardView.vue
git commit -m "$(cat <<'EOF'
feat: 剪贴板历史可写回并可删单条

EOF
)"
```

---

### Task 9: 全量验证

- [ ] **Step 1:**

```bash
pnpm test
pnpm typecheck
```

Expected: 全部绿。

- [ ] **Step 2: 手验清单（写进报告，不阻塞 commit）**

1. 改笔记标题，出现「未保存」；切另一条：保存 / 丢弃 / 取消。
2. 改文件正文后打开或点最近文件，三按钮同上；点「保存」不先弹确认。
3. 点历史写回，系统能贴出且列表不增一行；删单条后消失。
4. 关窗不弹未保存。

- [ ] **Step 3:** 若 Step 1 已绿且无未提交，本任务无新 commit。有漏网则：

```bash
git add -u
git commit -m "$(cat <<'EOF'
fix: 收口工作台体验的类型与测试

EOF
)"
```

---

## Spec 覆盖

| 规格 | 任务 |
| --- | --- |
| 快照 / 守卫纯函数 | Task 1 |
| 三按钮弹层、删除两按钮 | Task 5 |
| 笔记 dirty 标记与切走 / 新建 / leave | Task 6 |
| 文件 dirty、open / openRecent / leave；保存不先确认 | Task 7 |
| trash / forget 不问 | Task 7 |
| `clipboard:restore` / `delete` 契约 | Task 2 |
| 服务实现与单测 | Task 3 |
| IPC 适配 `writeImage`、`E_NOT_FOUND` | Task 4 |
| 剪贴板 UI | Task 8 |
| 关窗不拦 | 不改 `main.ts` close |
| 更新安装仍只看 `notesDirty` | 不改 `AboutView` |
| 全量验证 | Task 9 |
