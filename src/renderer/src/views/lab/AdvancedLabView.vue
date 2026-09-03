<script setup lang="ts">
import { computed } from 'vue'
import type { UpdaterStatus } from '@shared/models'
import LabPage from '../../components/LabPage.vue'
import { invokeIpc } from '../../composables/useIpc'
import { labModules } from '../../lab/catalog'
import { useAppStore } from '../../stores/app'

const MOCK_STATES: Array<{ status: UpdaterStatus; label: string }> = [
  { status: 'checking', label: '检查中' },
  { status: 'available', label: '有更新' },
  { status: 'downloading', label: '下载中' },
  { status: 'downloaded', label: '已下载' },
  { status: 'error', label: '出错' }
]

const store = useAppStore()
const currentStatus = computed(() => store.updaterStatus)
const advancedModule = computed(() => labModules.find((module) => module.path === '/lab/advanced'))
const crashDisabledIds = computed(() => (store.info?.isPackaged ? ['crash-main'] : []))

async function mock(status: UpdaterStatus): Promise<void> {
  await invokeIpc('updater:mock', status)
}
</script>

<template>
  <a-space direction="vertical" class="advanced-lab" :size="16">
    <LabPage
      v-if="advancedModule"
      :module="advancedModule"
      :disabled-action-ids="crashDisabledIds"
    />

    <a-card title="说明">
      <a-typography>
        <a-typography-paragraph>
          开发态不打 GitHub。这里用
          <a-typography-text code>updater:mock</a-typography-text>
          点五态，底栏的更新状态会跟着变。
        </a-typography-paragraph>
      </a-typography>
    </a-card>

    <a-card title="更新状态机">
      <a-space direction="vertical" :size="12">
        <a-alert type="info" show-icon :message="`当前状态：${currentStatus}`" />
        <a-space wrap>
          <a-button
            v-for="item in MOCK_STATES"
            :key="item.status"
            :type="currentStatus === item.status ? 'primary' : 'default'"
            @click="mock(item.status)"
          >
            {{ item.label }}
          </a-button>
        </a-space>
      </a-space>
    </a-card>
  </a-space>
</template>

<style scoped>
.advanced-lab {
  width: 100%;
}
</style>
