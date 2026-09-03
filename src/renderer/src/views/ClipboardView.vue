<script setup lang="ts">
import { imageCaption, itemDisplayText, useClipboard } from '../composables/useClipboard'

const { items, draft, readSystem, writeText, clearHistory, restore, remove } = useClipboard()
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
          <template #actions>
            <a-button type="link" danger @click.stop="remove(item.id)">删除</a-button>
          </template>
          <a-list-item-meta>
            <template #title>
              <div class="clipboard-restore" @click="restore(item.id)">
                <a-tag>{{ item.kind }}</a-tag>
                <span v-if="item.kind === 'image'">{{ imageCaption(item.imagePath) }}</span>
              </div>
            </template>
            <template #description>
              <pre
                v-if="itemDisplayText(item)"
                class="clipboard-text clipboard-restore"
                @click="restore(item.id)"
                >{{ itemDisplayText(item) }}</pre>
              <span
                v-else-if="item.kind === 'image'"
                class="clipboard-restore"
                @click="restore(item.id)"
                >已保存图片</span
              >
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

.clipboard-restore {
  cursor: pointer;
}
</style>
