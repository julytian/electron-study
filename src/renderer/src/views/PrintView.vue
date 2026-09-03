<script setup lang="ts">
import { usePrint } from '../composables/usePrint'

const { path, busy, exportPdf } = usePrint()
</script>

<template>
  <a-space direction="vertical" class="print-page" :size="16">
    <a-alert type="info" show-icon message="将当前主窗口导出为 PDF，并在文件夹中显示" />
    <a-button type="primary" :loading="busy" @click="exportPdf">导出 PDF</a-button>
    <a-descriptions v-if="path" bordered :column="1" size="small">
      <a-descriptions-item label="导出路径">{{ path }}</a-descriptions-item>
    </a-descriptions>
  </a-space>
</template>

<style scoped>
.print-page {
  width: 100%;
}
</style>
