import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AppInfo, AppSettings, UpdaterStatus } from '@shared/models'
import { defaultSettings } from '@shared/models'
import { invokeIpc } from '../composables/useIpc'

export const useAppStore = defineStore('app', () => {
  const info = ref<AppInfo | null>(null)
  const settings = ref<AppSettings>(defaultSettings)
  const updaterStatus = ref<UpdaterStatus>('idle')

  async function bootstrap(): Promise<void> {
    info.value = await invokeIpc('app:get-info')
    settings.value = await invokeIpc('conf:get')
    updaterStatus.value = info.value.updaterStatus
  }

  async function saveSettings(patch: Partial<AppSettings>): Promise<void> {
    settings.value = await invokeIpc('conf:set', patch)
  }

  return { info, settings, updaterStatus, bootstrap, saveSettings }
})
