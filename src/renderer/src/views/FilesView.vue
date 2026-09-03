<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useFiles } from '../composables/useFiles'

const OPEN_RECENT_KEY = 'electron-lab:open-recent'
const OPEN_RECENT_EVENT = 'electron-lab:open-recent'

const {
  path,
  content,
  contentLoaded,
  hasPath,
  recents,
  open,
  save,
  showInFolder,
  trash,
  startDrag,
  openRecent,
  forget
} = useFiles()

async function consumePendingRecent(): Promise<void> {
  const pending = sessionStorage.getItem(OPEN_RECENT_KEY)
  if (pending) {
    sessionStorage.removeItem(OPEN_RECENT_KEY)
    await openRecent(pending)
  }
}

onMounted(() => {
  void consumePendingRecent()
  window.addEventListener(OPEN_RECENT_EVENT, consumePendingRecent)
})

onUnmounted(() => {
  window.removeEventListener(OPEN_RECENT_EVENT, consumePendingRecent)
})

function formatOpenedAt(openedAt: number): string {
  return new Date(openedAt).toLocaleString()
}
</script>

<template>
  <a-space direction="vertical" class="files-page" :size="16">
    <a-alert
      type="info"
      show-icon
      message="沙箱下拖入请用「打开」按钮；拖出只能拖本次打开/保存过的文件"
    />
    <a-space wrap>
      <a-button type="primary" @click="open">打开</a-button>
      <a-button @click="save">保存</a-button>
      <a-button :disabled="!hasPath" @click="showInFolder()">显示位置</a-button>
      <a-button danger :disabled="!hasPath" @click="trash">移到回收站</a-button>
      <a-button :disabled="!hasPath" draggable="true" @dragstart="startDrag">拖出到桌面</a-button>
    </a-space>
    <a-card title="最近文件">
      <a-list :data-source="recents" item-key="id" :locale="{ emptyText: '还没有最近文件' }">
        <template #renderItem="{ item }">
          <a-list-item>
            <a-list-item-meta :title="item.path" :description="formatOpenedAt(item.openedAt)" />
            <template #actions>
              <a-button size="small" @click="openRecent(item.path)">打开</a-button>
              <a-button size="small" @click="showInFolder(item.path)">显示位置</a-button>
              <a-button size="small" danger @click="forget(item.path)">移除</a-button>
            </template>
          </a-list-item>
        </template>
      </a-list>
    </a-card>
    <a-descriptions bordered :column="1" size="small">
      <a-descriptions-item label="当前路径">
        {{ path || '尚未打开或保存文件' }}
      </a-descriptions-item>
    </a-descriptions>
    <a-alert
      v-if="hasPath && !contentLoaded"
      type="warning"
      show-icon
      message="文件超过 2MB，未读取正文"
    />
    <a-textarea v-model:value="content" :rows="16" placeholder="打开或编辑文本后可保存" />
  </a-space>
</template>

<style scoped>
.files-page {
  width: 100%;
}
</style>
