<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from './stores/app'

const store = useAppStore()
const router = useRouter()

onMounted(async () => {
  await store.bootstrap()
  const lastRoute = store.settings.ui.lastRoute
  if (lastRoute && lastRoute !== router.currentRoute.value.path) {
    await router.replace(lastRoute)
  }
})
</script>

<template>
  <RouterView />
</template>
