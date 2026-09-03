<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { shouldPersistLastRoute } from '@shared/routes'
import { useAppStore } from './stores/app'

const store = useAppStore()
const router = useRouter()

onMounted(async () => {
  await store.bootstrap()
  router.afterEach((to) => {
    if (!shouldPersistLastRoute(to.path)) return
    if (to.path === store.settings.ui.lastRoute) return
    void store.saveSettings({ ui: { lastRoute: to.path } })
  })
  const lastRoute = store.settings.ui.lastRoute
  if (lastRoute && lastRoute !== router.currentRoute.value.path) {
    await router.replace(lastRoute)
  }
})
</script>

<template>
  <RouterView />
</template>
