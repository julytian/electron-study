<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import type { LabAction, LabModule } from '../lab/catalog'
import { invokeIpc } from '../composables/useIpc'

const props = defineProps<{
  module: LabModule
  disabledActionIds?: string[]
}>()

const moduleKey = computed(() => props.module.path.split('/').filter(Boolean).at(-1) ?? '')
const lastMessage = shallowRef('')
const runningId = shallowRef('')

function isDisabled(action: LabAction): boolean {
  return props.disabledActionIds?.includes(action.id) ?? false
}

async function run(action: LabAction): Promise<void> {
  if (isDisabled(action)) return
  runningId.value = action.id
  lastMessage.value = ''
  try {
    const data = await invokeIpc('lab:run', moduleKey.value, action.id)
    lastMessage.value = data.message
  } catch {
    // invokeIpc 已 toast
  } finally {
    runningId.value = ''
  }
}
</script>

<template>
  <a-space direction="vertical" class="lab-page" :size="16">
    <a-card title="说明">
      <a-typography-paragraph>{{ module.summary }}</a-typography-paragraph>
    </a-card>

    <a-card title="演示">
      <a-space direction="vertical" :size="12">
        <a-space wrap>
          <a-button
            v-for="action in module.actions"
            :key="action.id"
            :danger="action.danger"
            :type="action.danger ? 'primary' : 'default'"
            :disabled="isDisabled(action)"
            :loading="runningId === action.id"
            @click="run(action)"
          >
            {{ action.title }}
            <template v-if="action.danger">（危险）</template>
          </a-button>
        </a-space>
        <a-typography-paragraph v-if="lastMessage" type="success">
          {{ lastMessage }}
        </a-typography-paragraph>
      </a-space>
    </a-card>

    <a-card title="要点">
      <a-typography-paragraph>{{ module.tips }}</a-typography-paragraph>
    </a-card>

    <a-card title="安全注意">
      <a-typography-paragraph>{{ module.safety }}</a-typography-paragraph>
    </a-card>
  </a-space>
</template>

<style scoped>
.lab-page {
  width: 100%;
}
</style>
