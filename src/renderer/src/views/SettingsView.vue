<script setup lang="ts">
import { Modal } from 'ant-design-vue'
import { useAppStore } from '../stores/app'
import { invokeIpc } from '../composables/useIpc'

const store = useAppStore()

async function onTheme(theme: 'system' | 'light' | 'dark'): Promise<void> {
  await store.saveSettings({
    appearance: { ...store.settings.appearance, theme }
  })
}

async function onCloseToTray(checked: boolean): Promise<void> {
  await store.saveSettings({
    behavior: { ...store.settings.behavior, closeToTray: checked }
  })
}

async function onAutoCheck(checked: boolean): Promise<void> {
  await store.saveSettings({
    updater: { ...store.settings.updater, autoCheck: checked }
  })
}

async function onAutoDownload(checked: boolean): Promise<void> {
  await store.saveSettings({
    updater: { ...store.settings.updater, autoDownload: checked }
  })
}

async function exportDb(): Promise<void> {
  await invokeIpc('db:export')
}

async function clearDb(): Promise<void> {
  Modal.confirm({
    title: '清空业务数据？',
    content: '笔记、剪贴板历史、下载记录、实验室日志都会删除，设置保留。',
    async onOk() {
      await invokeIpc('db:clear')
    }
  })
}
</script>

<template>
  <a-space direction="vertical" size="large" style="width: 100%">
    <a-card title="通用">
      <a-form layout="vertical">
        <a-form-item label="主题">
          <a-select
            :value="store.settings.appearance.theme"
            :options="[
              { value: 'system', label: '跟随系统' },
              { value: 'light', label: '浅色' },
              { value: 'dark', label: '深色' }
            ]"
            style="width: 200px"
            @change="onTheme"
          />
        </a-form-item>
        <a-form-item label="关闭到托盘">
          <a-switch :checked="store.settings.behavior.closeToTray" @change="onCloseToTray" />
        </a-form-item>
      </a-form>
    </a-card>
    <a-card title="更新">
      <a-form layout="vertical">
        <a-form-item label="启动后自动检查">
          <a-switch :checked="store.settings.updater.autoCheck" @change="onAutoCheck" />
        </a-form-item>
        <a-form-item label="发现更新后自动下载">
          <a-switch :checked="store.settings.updater.autoDownload" @change="onAutoDownload" />
        </a-form-item>
      </a-form>
    </a-card>
    <a-card title="存储">
      <a-space>
        <a-button @click="exportDb">导出数据库</a-button>
        <a-button danger @click="clearDb">清空业务表</a-button>
      </a-space>
    </a-card>
  </a-space>
</template>
