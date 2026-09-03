<script setup lang="ts">
import { onMounted, ref, shallowRef } from 'vue'
import type { TableColumnType } from 'ant-design-vue'
import { invokeIpc } from '../composables/useIpc'

interface MetricRow {
  pid: number
  type: string
  cpu: number
  memory: number
}

const rows = ref<MetricRow[]>([])
const crashInfo = shallowRef('')
const processEvents = shallowRef('')
const loading = shallowRef(false)

const columns: TableColumnType<MetricRow>[] = [
  { title: 'PID', dataIndex: 'pid', key: 'pid' },
  { title: '类型', dataIndex: 'type', key: 'type' },
  { title: 'CPU', key: 'cpu' },
  { title: '内存', key: 'memory' }
]

function formatCpu(value: number): string {
  return `${value.toFixed(1)}%`
}

function formatMemory(kb: number): string {
  return `${kb} KB`
}

async function refresh(): Promise<void> {
  loading.value = true
  try {
    rows.value = await invokeIpc('metrics:get')
    const dumps = await invokeIpc('lab:run', 'advanced', 'crash-dumps')
    crashInfo.value = dumps.message
    const gone = await invokeIpc('lab:run', 'metrics', 'recent-gone')
    processEvents.value = gone.message
  } catch {
    // invokeIpc 已 toast
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void refresh()
})
</script>

<template>
  <a-space direction="vertical" class="metrics-page" :size="16">
    <a-card title="进程与性能">
      <a-space direction="vertical" class="metrics-page" :size="12">
        <a-button type="primary" :loading="loading" @click="refresh">刷新</a-button>
        <a-table
          :columns="columns"
          :data-source="rows"
          :pagination="false"
          row-key="pid"
          size="small"
          :loading="loading"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'cpu'">{{ formatCpu(record.cpu) }}</template>
            <template v-else-if="column.key === 'memory'">{{
              formatMemory(record.memory)
            }}</template>
          </template>
        </a-table>
      </a-space>
    </a-card>
    <a-card title="崩溃转储">
      <a-typography-paragraph>
        {{ crashInfo || '尚未读取 crashDumps 目录。' }}
      </a-typography-paragraph>
    </a-card>
    <a-card title="进程事件">
      <a-typography-paragraph>
        {{ processEvents || '暂无进程事件' }}
      </a-typography-paragraph>
    </a-card>
  </a-space>
</template>

<style scoped>
.metrics-page {
  width: 100%;
}
</style>
