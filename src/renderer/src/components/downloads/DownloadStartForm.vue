<script setup lang="ts">
const url = defineModel<string>('url', { required: true })

defineProps<{
  canStart: boolean
}>()

const emit = defineEmits<{
  start: []
}>()
</script>

<template>
  <a-space wrap class="download-start">
    <a-input
      v-model:value="url"
      class="download-url"
      placeholder="输入 https 下载地址"
      allow-clear
      @press-enter="emit('start')"
    />
    <a-button type="primary" :disabled="!canStart" @click="emit('start')">开始下载</a-button>
  </a-space>
</template>

<style scoped>
.download-start {
  width: 100%;
}

.download-url {
  min-width: 280px;
  width: 420px;
}
</style>
