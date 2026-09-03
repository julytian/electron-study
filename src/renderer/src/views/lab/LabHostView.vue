<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import LabPage from '../../components/LabPage.vue'
import { labModules } from '../../lab/catalog'

const route = useRoute()
const current = computed(() => labModules.find((module) => module.path === route.path))
</script>

<template>
  <LabPage v-if="current" :module="current" />
  <a-result v-else status="info" title="未找到该实验室" sub-title="目录中没有对应模块。" />
</template>
