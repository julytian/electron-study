<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { SECURITY_CHECKLIST } from '@shared/security-checklist'
import LabPage from '../../components/LabPage.vue'
import { labModules } from '../../lab/catalog'

const columns = [
  { title: '条目', dataIndex: 'title', key: 'title' },
  { title: '文件', dataIndex: 'file', key: 'file' },
  { title: '说明', dataIndex: 'detail', key: 'detail' }
]

const route = useRoute()
const current = computed(() => labModules.find((module) => module.path === route.path))
const showChecklist = computed(() => current.value?.path === '/lab/security')
</script>

<template>
  <a-space v-if="current" direction="vertical" class="lab-host" :size="16">
    <a-card v-if="showChecklist" title="对照表">
      <a-table
        :columns="columns"
        :data-source="SECURITY_CHECKLIST"
        :pagination="false"
        row-key="id"
        size="small"
      />
    </a-card>
    <LabPage :module="current" />
  </a-space>
  <a-result v-else status="info" title="未找到该实验室" sub-title="目录中没有对应模块。" />
</template>

<style scoped>
.lab-host {
  width: 100%;
}
</style>
