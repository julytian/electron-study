<script setup lang="ts">
import { imageCaption, itemDisplayText, useClipboard } from '../composables/useClipboard'

const { items, draft, readSystem, writeText, clearHistory } = useClipboard()
</script>

<template>
  <a-space direction="vertical" class="clipboard-page" :size="16">
    <a-space wrap>
      <a-button type="primary" @click="readSystem">读取系统剪贴板</a-button>
      <a-input v-model:value="draft" class="clipboard-draft" placeholder="写入文本" allow-clear />
      <a-button :disabled="!draft" @click="writeText">写入文本</a-button>
      <a-button danger :disabled="!items.length" @click="clearHistory">清空历史</a-button>
    </a-space>
    <a-list :data-source="items" :locale="{ emptyText: '还没有剪贴板记录' }">
      <template #renderItem="{ item }">
        <a-list-item>
          <a-list-item-meta>
            <template #title>
              <a-tag>{{ item.kind }}</a-tag>
              <span v-if="item.kind === 'image'">{{ imageCaption(item.imagePath) }}</span>
            </template>
            <template #description>
              <pre v-if="itemDisplayText(item)" class="clipboard-text">{{
                itemDisplayText(item)
              }}</pre>
              <span v-else-if="item.kind === 'image'">已保存图片</span>
            </template>
          </a-list-item-meta>
        </a-list-item>
      </template>
    </a-list>
  </a-space>
</template>

<style scoped>
.clipboard-page {
  width: 100%;
}

.clipboard-draft {
  width: 280px;
}

.clipboard-text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
