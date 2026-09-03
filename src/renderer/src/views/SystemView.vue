<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue'
import type { ThemeMode } from '@shared/models'
import { invokeIpc } from '../composables/useIpc'
import { useAppStore } from '../stores/app'

const store = useAppStore()
const power = shallowRef<{ onBattery: boolean; idleState: string; online: boolean } | null>(null)
const loginEnabled = computed(() => store.settings.behavior.openAtLogin)
const theme = computed(() => store.settings.appearance.theme)
const batteryOn = computed(() =>
  store.onBattery !== null ? store.onBattery : (power.value?.onBattery ?? null)
)
const networkOn = computed(() =>
  store.online !== null ? store.online : (power.value?.online ?? null)
)

const themeOptions: Array<{ value: ThemeMode; label: string }> = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' }
]

async function refreshSettings(): Promise<void> {
  store.settings = await invokeIpc('conf:get')
}

async function notify(): Promise<void> {
  await invokeIpc('system:notify', {
    title: 'Electron Lab',
    body: '点击通知可回到系统能力页',
    route: '/workbench/system'
  })
}

async function readPower(): Promise<void> {
  power.value = await invokeIpc('system:get-power')
}

async function setTheme(value: ThemeMode): Promise<void> {
  await invokeIpc('system:set-theme', value)
  await refreshSettings()
}

async function setLogin(enabled: boolean): Promise<void> {
  try {
    await invokeIpc('system:set-login', enabled)
  } catch {
    // invokeIpc 已 toast E_PLATFORM
  }
  await refreshSettings()
}

onMounted(() => {
  void readPower()
})
</script>

<template>
  <a-space direction="vertical" class="system-page" :size="16">
    <a-card title="系统能力">
      <a-space direction="vertical" :size="16" class="system-page">
        <a-space wrap>
          <a-button type="primary" @click="notify">发通知</a-button>
          <a-button @click="readPower">读电源</a-button>
        </a-space>
        <a-descriptions
          v-if="batteryOn !== null || networkOn !== null || power"
          bordered
          :column="1"
          size="small"
        >
          <a-descriptions-item v-if="batteryOn !== null" label="电池供电">
            {{ batteryOn ? '是' : '否' }}
          </a-descriptions-item>
          <a-descriptions-item v-if="networkOn !== null" label="网络">
            {{ networkOn ? '在线' : '离线' }}
          </a-descriptions-item>
          <a-descriptions-item v-if="power" label="空闲状态">
            {{ power.idleState }}
          </a-descriptions-item>
        </a-descriptions>
        <a-form layout="vertical">
          <a-form-item label="主题切换">
            <a-radio-group :value="theme" @update:value="setTheme">
              <a-radio-button v-for="item in themeOptions" :key="item.value" :value="item.value">
                {{ item.label }}
              </a-radio-button>
            </a-radio-group>
          </a-form-item>
          <a-form-item label="开机自启">
            <a-switch :checked="loginEnabled" @change="setLogin" />
          </a-form-item>
        </a-form>
      </a-space>
    </a-card>
  </a-space>
</template>

<style scoped>
.system-page {
  width: 100%;
}
</style>
