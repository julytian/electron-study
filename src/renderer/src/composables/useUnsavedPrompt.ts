import { Modal, Button } from 'ant-design-vue'
import { h } from 'vue'
import type { UnsavedChoice } from '@shared/unsaved'

export function askUnsaved(message = '有未保存的更改'): Promise<UnsavedChoice> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (choice: UnsavedChoice): void => {
      if (settled) return
      settled = true
      resolve(choice)
    }
    const modal = Modal.confirm({
      title: message,
      content: '保存后继续，或丢弃更改。',
      closable: true,
      keyboard: true,
      maskClosable: true,
      onCancel: () => finish('cancel'),
      footer: () =>
        h('div', { style: 'display:flex;gap:8px;justify-content:flex-end' }, [
          h(
            Button,
            {
              onClick: () => {
                modal.destroy()
                finish('cancel')
              }
            },
            () => '取消'
          ),
          h(
            Button,
            {
              onClick: () => {
                modal.destroy()
                finish('discard')
              }
            },
            () => '丢弃'
          ),
          h(
            Button,
            {
              type: 'primary',
              onClick: () => {
                modal.destroy()
                finish('save')
              }
            },
            () => '保存'
          )
        ])
    })
  })
}

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
