<script setup lang="ts">
import CaptureSourceList from '../components/capture/CaptureSourceList.vue'
import { useCapture } from '../composables/useCapture'

const { sources, path, busy, refresh, save } = useCapture()
</script>

<template>
  <a-space direction="vertical" class="capture-page" :size="16">
    <a-alert type="info" show-icon message="列出屏幕和窗口缩略图，保存到导出目录" />
    <a-button :loading="busy" @click="refresh">刷新源</a-button>
    <a-descriptions v-if="path" bordered :column="1" size="small">
      <a-descriptions-item label="已保存">{{ path }}</a-descriptions-item>
    </a-descriptions>
    <CaptureSourceList :sources="sources" @save="save" />
  </a-space>
</template>

<style scoped>
.capture-page {
  width: 100%;
}
</style>
