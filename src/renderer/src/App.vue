<script setup lang="ts">
import { onMounted } from 'vue'
import { useAppStore } from './stores/app'

const store = useAppStore()
onMounted(() => {
  void store.bootstrap()
})
</script>

<template>
  <RouterView />
</template>
