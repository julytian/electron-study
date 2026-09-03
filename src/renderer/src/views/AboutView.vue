<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import type { UpdaterStatus } from '@shared/models'
import { useAppStore } from '../stores/app'
import { invokeIpc } from '../composables/useIpc'

const STATUS_LABEL: Record<UpdaterStatus, string> = {
  idle: '空闲',
  checking: '检查中',
  available: '有新版本',
  'not-available': '已是最新',
  downloading: '下载中',
  downloaded: '已下载，待安装',
  error: '出错'
}

const store = useAppStore()
const checking = shallowRef(false)
const downloading = shallowRef(false)
const installing = shallowRef(false)

const canDownload = computed(() => store.updaterStatus === 'available')
const canInstall = computed(() => store.updaterStatus === 'downloaded')
const showMockHint = computed(() => !store.info?.isPackaged || !store.info?.hasRepository)
const statusText = computed(() => STATUS_LABEL[store.updaterStatus])
const progressText = computed(() => {
  if (store.updaterStatus !== 'downloading') return ''
  return `${Math.round(store.updaterProgress)}%`
})

async function openLogs(): Promise<void> {
  await invokeIpc('shell:open-logs')
}

async function check(): Promise<void> {
  checking.value = true
  try {
    const result = await invokeIpc('updater:check')
    store.updaterStatus = result.status
    if (result.version) store.updaterVersion = result.version
  } catch {
    // invokeIpc 已 toast
  } finally {
    checking.value = false
  }
}

async function download(): Promise<void> {
  if (!canDownload.value) return
  downloading.value = true
  try {
    await invokeIpc('updater:download')
  } catch {
    // invokeIpc 已 toast
  } finally {
    downloading.value = false
  }
}

async function install(): Promise<void> {
  if (!canInstall.value) return
  if (store.notesDirty) {
    const ok = window.confirm('有未保存的笔记，重启安装会丢失这些更改。确定继续？')
    if (!ok) return
  }
  installing.value = true
  try {
    await invokeIpc('updater:install')
  } catch {
    // invokeIpc 已 toast
  } finally {
    installing.value = false
  }
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
      <a-descriptions-item label="更新">
        {{ statusText }}（{{ store.updaterStatus }}）
        <template v-if="store.updaterVersion"> · {{ store.updaterVersion }}</template>
        <template v-if="progressText"> · {{ progressText }}</template>
      </a-descriptions-item>
    </a-descriptions>
    <a-alert
      v-if="showMockHint"
      style="margin-top: 16px"
      type="info"
      show-icon
      message="提示：开发态或不存在 repository 时不请求 GitHub，只用 mock。"
    />
    <a-space style="margin-top: 16px" wrap>
      <a-button :loading="checking" @click="check">检查更新</a-button>
      <a-button :disabled="!canDownload" :loading="downloading" @click="download">下载</a-button>
      <a-button type="primary" :disabled="!canInstall" :loading="installing" @click="install">
        重启安装
      </a-button>
      <a-button @click="openLogs">打开日志目录</a-button>
    </a-space>
  </a-card>
</template>
