<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { routeGroups } from '@shared/routes'

const route = useRoute()
const title = computed(() => {
  for (const group of routeGroups) {
    const item = group.items.find((entry) => entry.path === route.path)
    if (item) return item.title
  }
  return route.path
})
</script>

<template>
  <a-result status="info" :title="title" sub-title="该模块将在后续分期接入，导航与路由已就绪。" />
</template>
