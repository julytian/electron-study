import { Conf } from 'electron-conf/main'
import { defaultSettings, type AppSettings } from '../../shared/models'
import { getAppUserData } from './paths'

let conf: Conf<AppSettings> | null = null

export function getConf(): Conf<AppSettings> {
  if (!conf) {
    conf = new Conf<AppSettings>({
      dir: getAppUserData(),
      name: 'config',
      defaults: defaultSettings
    })
  }
  return conf
}

export function getSettings(): AppSettings {
  return getConf().store
}

export function patchSettings(patch: Partial<AppSettings>): AppSettings {
  const current = getSettings()
  const next: AppSettings = {
    ...current,
    ...patch,
    appearance: { ...current.appearance, ...patch.appearance },
    window: { ...current.window, ...patch.window },
    behavior: { ...current.behavior, ...patch.behavior },
    shortcuts: { ...current.shortcuts, ...patch.shortcuts },
    updater: { ...current.updater, ...patch.updater },
    protocol: { ...current.protocol, ...patch.protocol },
    ui: { ...current.ui, ...patch.ui }
  }
  getConf().set(next)
  return next
}
