<script setup lang="ts">
import { useFiles } from '../composables/useFiles'

const { path, content, contentLoaded, hasPath, open, save, showInFolder, trash, startDrag } =
  useFiles()
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
      <a-button :disabled="!hasPath" @click="showInFolder">显示位置</a-button>
      <a-button danger :disabled="!hasPath" @click="trash">移到回收站</a-button>
      <a-button :disabled="!hasPath" draggable="true" @dragstart="startDrag">拖出到桌面</a-button>
    </a-space>
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
