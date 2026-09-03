<script setup lang="ts">
import type { CaptureSource } from '../../composables/useCapture'

defineProps<{
  sources: CaptureSource[]
}>()

const emit = defineEmits<{
  save: [source: CaptureSource]
}>()
</script>

<template>
  <a-list :data-source="sources" :locale="{ emptyText: '没有可捕获的屏幕或窗口' }">
    <template #renderItem="{ item }">
      <a-list-item>
        <a-list-item-meta :title="item.name">
          <template #avatar>
            <img class="capture-thumb" :src="item.thumbnailDataUrl" :alt="item.name" />
          </template>
        </a-list-item-meta>
        <template #actions>
          <a-button type="primary" size="small" @click="emit('save', item)">保存</a-button>
        </template>
      </a-list-item>
    </template>
  </a-list>
</template>

<style scoped>
.capture-thumb {
  width: 96px;
  height: 64px;
  object-fit: cover;
  border-radius: 4px;
}
</style>
