<script setup lang="ts">
import { useAppStore } from '../stores/app'
import { invokeIpc } from '../composables/useIpc'

const store = useAppStore()

async function openLogs(): Promise<void> {
  await invokeIpc('shell:open-logs')
}
</script>

<template>
  <a-card title="关于 / 诊断">
    <a-descriptions bordered :column="1">
      <a-descriptions-item label="版本">{{ store.info?.version }}</a-descriptions-item>
      <a-descriptions-item label="Electron">{{ store.info?.electron }}</a-descriptions-item>
      <a-descriptions-item label="Chromium">{{ store.info?.chrome }}</a-descriptions-item>
      <a-descriptions-item label="Node">{{ store.info?.node }}</a-descriptions-item>
      <a-descriptions-item label="userData">{{ store.info?.userData }}</a-descriptions-item>
      <a-descriptions-item label="更新">{{ store.updaterStatus }}</a-descriptions-item>
    </a-descriptions>
    <a-button style="margin-top: 16px" @click="openLogs">打开日志目录</a-button>
  </a-card>
</template>
