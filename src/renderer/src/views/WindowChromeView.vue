<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { invokeIpc } from '../composables/useIpc'
import { useAppStore } from '../stores/app'

const store = useAppStore()
const overlayOn = shallowRef(false)
const platform = computed(() => store.info?.platform ?? 'unknown')

const capabilityCopy = computed(() => {
  if (platform.value === 'win32') {
    return 'Windows 可检测 Mica / Acrylic 与 titleBarOverlay。本页只演示 overlay，不把 Mica 设为默认壳。'
  }
  if (platform.value === 'darwin') {
    return 'macOS 可检测交通灯位置与 vibrancy。本页只演示 titleBarOverlay，不改默认系统标题栏。'
  }
  return '当前平台通常不支持 titleBarOverlay / Mica。开关失败会返回 E_PLATFORM，入口保持可见。'
})

async function setOverlay(enabled: boolean): Promise<void> {
  try {
    await invokeIpc('window:set-overlay', enabled)
    overlayOn.value = enabled
  } catch {
    // invokeIpc 已 toast E_PLATFORM
  }
}
</script>

<template>
  <a-space direction="vertical" class="window-chrome" :size="16">
    <a-card title="现代窗口外观">
      <a-space direction="vertical" :size="16" class="window-chrome">
        <a-form layout="vertical">
          <a-form-item label="titleBarOverlay">
            <a-switch :checked="overlayOn" @change="setOverlay" />
          </a-form-item>
        </a-form>
        <a-alert type="info" show-icon :message="capabilityCopy" />
        <a-typography-paragraph>
          能力检测：平台 {{ platform }}。第一期默认仍用系统标题栏；Mica
          与交通灯仅作说明，不作为默认窗口铬。
        </a-typography-paragraph>
      </a-space>
    </a-card>
  </a-space>
</template>

<style scoped>
.window-chrome {
  width: 100%;
}
</style>
