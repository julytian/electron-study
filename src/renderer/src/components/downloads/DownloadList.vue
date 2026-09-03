<script setup lang="ts">
import type { DownloadRecord } from '@shared/models'
import { progressText, stateLabel } from '../../composables/useDownloads'

defineProps<{
  items: DownloadRecord[]
}>()

const emit = defineEmits<{
  pause: [id: number]
  resume: [id: number]
  cancel: [id: number]
}>()
</script>

<template>
  <a-list :data-source="items" :locale="{ emptyText: '还没有下载记录' }">
    <template #renderItem="{ item }">
      <a-list-item>
        <a-list-item-meta>
          <template #title>
            <span>{{ item.filename }}</span>
            <a-tag class="download-state">{{ stateLabel(item.state) }}</a-tag>
          </template>
          <template #description>
            <div>{{ item.url }}</div>
            <div>{{ progressText(item) }}</div>
            <div v-if="item.savePath">{{ item.savePath }}</div>
          </template>
        </a-list-item-meta>
        <template #actions>
          <a-button
            size="small"
            :disabled="item.state !== 'progressing'"
            @click="emit('pause', item.id)"
          >
            暂停
          </a-button>
          <a-button
            size="small"
            :disabled="item.state !== 'paused'"
            @click="emit('resume', item.id)"
          >
            恢复
          </a-button>
          <a-button
            size="small"
            danger
            :disabled="item.state !== 'progressing' && item.state !== 'paused'"
            @click="emit('cancel', item.id)"
          >
            取消
          </a-button>
        </template>
      </a-list-item>
    </template>
  </a-list>
</template>

<style scoped>
.download-state {
  margin-left: 8px;
}
</style>
