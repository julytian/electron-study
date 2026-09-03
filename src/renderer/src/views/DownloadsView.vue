<script setup lang="ts">
import DownloadList from '../components/downloads/DownloadList.vue'
import DownloadStartForm from '../components/downloads/DownloadStartForm.vue'
import { useDownloads } from '../composables/useDownloads'

const { items, url, canStart, start, pause, resume, cancel } = useDownloads()
</script>

<template>
  <a-space direction="vertical" class="downloads-page" :size="16">
    <a-alert type="info" show-icon message="仅允许 https 地址，进度会实时刷新" />
    <DownloadStartForm v-model:url="url" :can-start="canStart" @start="start" />
    <DownloadList :items="items" @pause="pause" @resume="resume" @cancel="cancel" />
  </a-space>
</template>

<style scoped>
.downloads-page {
  width: 100%;
}
</style>
