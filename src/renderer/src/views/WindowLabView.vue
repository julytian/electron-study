<script setup lang="ts">
import { shallowRef } from 'vue'
import { invokeIpc } from '../composables/useIpc'

const progress = shallowRef(0)
const fullscreen = shallowRef(false)

async function createChild(): Promise<void> {
  await invokeIpc('window:create-child')
}

async function createFloat(): Promise<void> {
  await invokeIpc('window:create-float')
}

async function setProgress(value: number): Promise<void> {
  progress.value = value
  await invokeIpc('window:set-progress', value)
}

async function setFullscreen(flag: boolean): Promise<void> {
  fullscreen.value = flag
  await invokeIpc('window:set-fullscreen', flag)
}
</script>

<template>
  <a-space direction="vertical" class="window-lab" :size="16">
    <a-card title="窗口实验室">
      <a-space direction="vertical" :size="16" class="window-lab">
        <a-space wrap>
          <a-button type="primary" @click="createChild">创建子窗</a-button>
          <a-button @click="createFloat">创建悬浮窗</a-button>
        </a-space>
        <a-form layout="vertical">
          <a-form-item :label="`任务栏进度 ${progress.toFixed(2)}`">
            <a-slider :min="0" :max="1" :step="0.01" :value="progress" @change="setProgress" />
          </a-form-item>
          <a-form-item label="全屏">
            <a-switch :checked="fullscreen" @change="setFullscreen" />
          </a-form-item>
        </a-form>
      </a-space>
    </a-card>
  </a-space>
</template>

<style scoped>
.window-lab {
  width: 100%;
}
</style>
