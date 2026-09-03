<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef } from 'vue'
import { invokeIpc } from '../composables/useIpc'

const url = shallowRef('')
const canBack = shallowRef(false)
const canForward = shallowRef(false)
const query = shallowRef('')
const matchOrdinal = shallowRef(0)
const matchCount = shallowRef(0)

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

async function applyFind(action: 'next' | 'previous' | 'stop'): Promise<void> {
  try {
    const result = await invokeIpc('browser:find', query.value, action)
    matchOrdinal.value = result.activeMatchOrdinal
    matchCount.value = result.matches
  } catch {
    // invokeIpc 已 toast
  }
}

async function findNext(): Promise<void> {
  await applyFind('next')
}

async function findPrevious(): Promise<void> {
  await applyFind('previous')
}

async function onQueryChange(value: string): Promise<void> {
  query.value = value
  if (value.trim() === '') {
    await applyFind('stop')
  }
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
    <a-space class="browser-toolbar browser-find" :size="8">
      <a-input
        :value="query"
        class="browser-find-input"
        placeholder="页内查找"
        allow-clear
        @update:value="onQueryChange"
        @press-enter="findNext"
      />
      <a-button @click="findPrevious">上一个</a-button>
      <a-button @click="findNext">下一个</a-button>
      <span class="browser-find-count">{{ matchOrdinal }} / {{ matchCount }}</span>
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

.browser-find {
  margin-top: 8px;
}

.browser-url {
  min-width: 280px;
  flex: 1;
}

.browser-find-input {
  min-width: 200px;
}

.browser-find-count {
  color: rgba(0, 0, 0, 0.45);
  white-space: nowrap;
}
</style>
