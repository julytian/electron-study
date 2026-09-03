<script setup lang="ts">
import { invokeIpc } from '../composables/useIpc'

async function openPair(): Promise<void> {
  await invokeIpc('port:create-pair')
}
</script>

<template>
  <a-space direction="vertical" class="window-ports" :size="16">
    <a-card title="跨窗口通信">
      <a-space direction="vertical" :size="16" class="window-ports">
        <a-button type="primary" @click="openPair">打开左右窗</a-button>
        <a-alert
          type="info"
          show-icon
          message="左右子窗通过 MessagePort 互发消息。请到子窗里输入并发送，主页不转发正文。"
        />
      </a-space>
    </a-card>
  </a-space>
</template>

<style scoped>
.window-ports {
  width: 100%;
}
</style>
