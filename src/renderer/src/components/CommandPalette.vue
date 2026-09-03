<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef, watch } from 'vue'
import { isNavigationFailure, useRouter } from 'vue-router'
import { routeGroups } from '@shared/routes'
import type { RecentFile } from '@shared/models'
import { invokeIpc } from '../composables/useIpc'

const OPEN_RECENT_KEY = 'electron-lab:open-recent'
const OPEN_RECENT_EVENT = 'electron-lab:open-recent'

const open = shallowRef(false)
const keyword = shallowRef('')
const recents = shallowRef<RecentFile[]>([])
const router = useRouter()

const routeItems = computed(() =>
  routeGroups
    .flatMap((group) => group.items.map((item) => ({ ...item, group: group.title })))
    .filter((item) => item.title.includes(keyword.value) || item.path.includes(keyword.value))
)

const recentItems = computed(() =>
  recents.value.filter((item) => item.path.includes(keyword.value)).slice(0, 15)
)

async function loadRecents(): Promise<void> {
  try {
    recents.value = await invokeIpc('files:recent')
  } catch {
    recents.value = []
  }
}

watch(open, (isOpen) => {
  if (isOpen) void loadRecents()
})

function onKey(event: KeyboardEvent): void {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    open.value = !open.value
  }
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))

async function go(path: string): Promise<void> {
  open.value = false
  await router.push(path)
}

async function goRecent(filePath: string): Promise<void> {
  open.value = false
  const nav = await router.push('/workbench/files')
  if (isNavigationFailure(nav)) return
  sessionStorage.setItem(OPEN_RECENT_KEY, filePath)
  window.dispatchEvent(new CustomEvent(OPEN_RECENT_EVENT))
}
</script>

<template>
  <a-modal v-model:open="open" title="跳转" :footer="null">
    <a-input v-model:value="keyword" placeholder="搜索模块" />
    <a-list :data-source="routeItems" item-key="path" style="margin-top: 12px">
      <template #header>模块</template>
      <template #renderItem="{ item }">
        <a-list-item>
          <a-button type="link" @click="go(item.path)"
            >{{ item.group }} / {{ item.title }}</a-button
          >
        </a-list-item>
      </template>
    </a-list>
    <a-list :data-source="recentItems" item-key="id">
      <template #header>最近文件</template>
      <template #renderItem="{ item }">
        <a-list-item>
          <a-button type="link" @click="goRecent(item.path)">{{ item.path }}</a-button>
        </a-list-item>
      </template>
    </a-list>
  </a-modal>
</template>
