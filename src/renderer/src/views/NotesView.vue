<script setup lang="ts">
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import { useNotes } from '../composables/useNotes'

const route = useRoute()
const { notes, current, keyword, refresh, open, create, save, remove } = useNotes()

watch(
  () => route.query.id,
  (id) => {
    const raw = Array.isArray(id) ? id[0] : id
    if (typeof raw !== 'string' || raw === '') return
    const noteId = Number(raw)
    if (!Number.isInteger(noteId) || noteId <= 0) return
    void open(noteId)
  },
  { immediate: true }
)

async function onRemove(): Promise<void> {
  if (!current.value) return
  await remove(current.value.id)
}
</script>

<template>
  <a-row :gutter="16" class="notes-page">
    <a-col :span="8" class="notes-pane">
      <a-space direction="vertical" style="width: 100%" :size="12">
        <a-input-search
          v-model:value="keyword"
          placeholder="搜索标题或正文"
          allow-clear
          @search="refresh"
        />
        <a-space>
          <a-button type="primary" @click="create">新建</a-button>
          <a-button danger :disabled="!current" @click="onRemove">删除</a-button>
        </a-space>
        <a-list :data-source="notes" :locale="{ emptyText: '还没有笔记' }">
          <template #renderItem="{ item }">
            <a-list-item
              :class="{ 'notes-item-active': current?.id === item.id }"
              @click="open(item.id)"
            >
              <a-list-item-meta :title="item.title || '未命名'" />
              <template #extra>
                <a-tag v-if="item.pinned">置顶</a-tag>
              </template>
            </a-list-item>
          </template>
        </a-list>
      </a-space>
    </a-col>
    <a-col :span="16" class="notes-pane">
      <a-form v-if="current" layout="vertical">
        <a-form-item label="标题">
          <a-input v-model:value="current.title" placeholder="标题" />
        </a-form-item>
        <a-form-item label="正文">
          <a-textarea v-model:value="current.body" :rows="16" placeholder="正文" />
        </a-form-item>
        <a-space wrap>
          <a-form-item label="加密" class="notes-switch">
            <a-switch v-model:checked="current.isEncrypted" />
          </a-form-item>
          <a-form-item label="置顶" class="notes-switch">
            <a-switch v-model:checked="current.pinned" />
          </a-form-item>
          <a-button type="primary" @click="save">保存</a-button>
        </a-space>
      </a-form>
      <a-empty v-else description="选择一条笔记，或新建一条">
        <a-button type="primary" @click="create">新建</a-button>
      </a-empty>
    </a-col>
  </a-row>
</template>

<style scoped>
.notes-page {
  height: calc(100vh - 96px);
}

.notes-pane {
  height: 100%;
  overflow: auto;
}

.notes-item-active {
  background: rgba(22, 119, 255, 0.08);
}

.notes-switch {
  margin-bottom: 0;
}
</style>
