<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { routeGroups } from '@shared/routes'

const open = ref(false)
const keyword = ref('')
const router = useRouter()
const items = computed(() =>
  routeGroups
    .flatMap((group) => group.items.map((item) => ({ ...item, group: group.title })))
    .filter((item) => item.title.includes(keyword.value) || item.path.includes(keyword.value))
)

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
</script>

<template>
  <a-modal v-model:open="open" title="跳转" :footer="null">
    <a-input v-model:value="keyword" placeholder="搜索模块" />
    <a-list :data-source="items" style="margin-top: 12px">
      <template #renderItem="{ item }">
        <a-list-item>
          <a-button type="link" @click="go(item.path)"
            >{{ item.group }} / {{ item.title }}</a-button
          >
        </a-list-item>
      </template>
    </a-list>
  </a-modal>
</template>
