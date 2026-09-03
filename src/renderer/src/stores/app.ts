import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AppInfo, AppSettings, UpdaterStatus } from '@shared/models'
import { defaultSettings } from '@shared/models'
import { invokeIpc } from '../composables/useIpc'

export const useAppStore = defineStore('app', () => {
  const info = ref<AppInfo | null>(null)
  const settings = ref<AppSettings>(defaultSettings)
  const updaterStatus = ref<UpdaterStatus>('idle')
  const updaterVersion = ref<string | undefined>()
  const updaterProgress = ref(0)
  const updaterMessage = ref<string | undefined>()
  const notesDirty = ref(false)
  const onBattery = ref<boolean | null>(null)

  let subscribed = false

  function subscribeUpdater(): void {
    if (subscribed) return
    subscribed = true
    window.api.on('updater:status', (payload) => {
      updaterStatus.value = payload.status
      if (payload.version !== undefined) updaterVersion.value = payload.version
      updaterMessage.value = payload.message
    })
    window.api.on('updater:progress', (payload) => {
      updaterProgress.value = payload.percent
    })
    window.api.on('theme:changed', (payload) => {
      settings.value = {
        ...settings.value,
        appearance: { ...settings.value.appearance, theme: payload.theme }
      }
    })
    window.api.on('power:changed', (payload) => {
      onBattery.value = payload.onBattery
    })
  }

  async function bootstrap(): Promise<void> {
    info.value = await invokeIpc('app:get-info')
    settings.value = await invokeIpc('conf:get')
    updaterStatus.value = info.value.updaterStatus
    subscribeUpdater()
  }

  async function saveSettings(patch: Partial<AppSettings>): Promise<void> {
    settings.value = await invokeIpc('conf:set', patch)
  }

  return {
    info,
    settings,
    updaterStatus,
    updaterVersion,
    updaterProgress,
    updaterMessage,
    notesDirty,
    onBattery,
    bootstrap,
    saveSettings
  }
})
