<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef } from 'vue'
import { invokeIpc } from '../composables/useIpc'

const url = shallowRef('')
const canBack = shallowRef(false)
const canForward = shallowRef(false)

let offNav: (() => void) | undefined

onMounted(async () => {
  offNav = window.api.on('browser:nav', (payload) => {
    url.value = payload.url
    canBack.value = payload.canBack
    canForward.value = payload.canForward
  })
  await invokeIpc('browser:create')
})

onBeforeUnmount(() => {
  offNav?.()
})

async function navigate(): Promise<void> {
  await invokeIpc('browser:navigate', url.value)
}

async function go(action: 'back' | 'forward' | 'reload'): Promise<void> {
  await invokeIpc('browser:go', action)
}
</script>

<template>
  <div class="browser-page">
    <a-space class="browser-toolbar" :size="8">
      <a-button :disabled="!canBack" @click="go('back')">后退</a-button>
      <a-button :disabled="!canForward" @click="go('forward')">前进</a-button>
      <a-button @click="go('reload')">刷新</a-button>
      <a-input
        v-model:value="url"
        class="browser-url"
        placeholder="输入 https 地址或 example.com"
        allow-clear
        @press-enter="navigate"
      />
      <a-button type="primary" @click="navigate">前往</a-button>
    </a-space>
  </div>
</template>

<style scoped>
.browser-page {
  width: 100%;
}

.browser-toolbar {
  width: 100%;
}

.browser-url {
  min-width: 280px;
  flex: 1;
}
</style>
