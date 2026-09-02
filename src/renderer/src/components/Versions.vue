<script setup lang="ts">
import { onMounted, reactive } from 'vue'

const versions = reactive({
  electron: '',
  chrome: '',
  node: ''
})

onMounted(async () => {
  const result = await window.api.invoke('app:get-info')
  if (!result.ok) return
  versions.electron = result.data.electron
  versions.chrome = result.data.chrome
  versions.node = result.data.node
})
</script>

<template>
  <ul class="versions">
    <li class="electron-version">Electron v{{ versions.electron }}</li>
    <li class="chrome-version">Chromium v{{ versions.chrome }}</li>
    <li class="node-version">Node v{{ versions.node }}</li>
  </ul>
</template>
