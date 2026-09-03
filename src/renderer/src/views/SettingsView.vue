<script setup lang="ts">
import { computed, reactive, shallowRef } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { isAcceleratorShape } from '@shared/accelerator'
import { useAppStore } from '../stores/app'
import { invokeIpc } from '../composables/useIpc'

const store = useAppStore()
const isMac = computed(() => store.info?.platform === 'darwin')
const protocolBusy = shallowRef(false)
const protocolRegistered = computed(() => store.settings.protocol.registered)
const shortcutDraft = reactive({ ...store.settings.shortcuts })

async function onTheme(theme: 'system' | 'light' | 'dark'): Promise<void> {
  await invokeIpc('system:set-theme', theme)
  store.settings = await invokeIpc('conf:get')
}

async function onLogin(enabled: boolean): Promise<void> {
  try {
    await invokeIpc('system:set-login', enabled)
  } catch {
    // invokeIpc 已 toast E_PLATFORM
  }
  store.settings = await invokeIpc('conf:get')
}

async function onCloseToTray(checked: boolean): Promise<void> {
  if (isMac.value) return
  await store.saveSettings({
    behavior: { ...store.settings.behavior, closeToTray: checked }
  })
}

async function onAutoCheck(checked: boolean): Promise<void> {
  await store.saveSettings({
    updater: { ...store.settings.updater, autoCheck: checked }
  })
}

async function onAutoDownload(checked: boolean): Promise<void> {
  await store.saveSettings({
    updater: { ...store.settings.updater, autoDownload: checked }
  })
}

async function saveShortcuts(): Promise<void> {
  const next = {
    toggleWindow: shortcutDraft.toggleWindow.trim(),
    clipboard: shortcutDraft.clipboard.trim(),
    notes: shortcutDraft.notes.trim()
  }
  if (
    !isAcceleratorShape(next.toggleWindow) ||
    !isAcceleratorShape(next.clipboard) ||
    !isAcceleratorShape(next.notes)
  ) {
    message.error('快捷键需写成 Electron 加速键，例如 CommandOrControl+Shift+L')
    return
  }
  await store.saveSettings({ shortcuts: next })
}

async function registerProtocol(): Promise<void> {
  Modal.confirm({
    title: '注册 electron-lab:// 协议？',
    content: '会把本应用设为 electron-lab 协议的默认打开方式。开发态可能需要安装包后才完全生效。',
    async onOk() {
      protocolBusy.value = true
      try {
        const data = await invokeIpc('protocol:register')
        if (data.ok) {
          store.settings.protocol.registered = true
          return
        }
        message.error('协议注册失败，当前环境可能无法设为默认打开方式')
      } catch {
        // invokeIpc 已 toast
      } finally {
        protocolBusy.value = false
      }
    }
  })
}

async function exportDb(): Promise<void> {
  await invokeIpc('db:export')
}

async function clearDb(): Promise<void> {
  Modal.confirm({
    title: '清空业务数据？',
    content: '笔记、剪贴板历史、下载记录、实验室日志都会删除，设置保留。',
    async onOk() {
      await invokeIpc('db:clear')
    }
  })
}
</script>

<template>
  <a-space direction="vertical" size="large" style="width: 100%">
    <a-card title="通用">
      <a-form layout="vertical">
        <a-form-item label="主题">
          <a-select
            :value="store.settings.appearance.theme"
            :options="[
              { value: 'system', label: '跟随系统' },
              { value: 'light', label: '浅色' },
              { value: 'dark', label: '深色' }
            ]"
            style="width: 200px"
            @change="onTheme"
          />
        </a-form-item>
        <a-form-item label="关闭到托盘">
          <a-switch
            :checked="isMac ? true : store.settings.behavior.closeToTray"
            :disabled="isMac"
            @change="onCloseToTray"
          />
          <a-typography-paragraph type="secondary" class="settings-hint">
            {{
              isMac
                ? 'macOS 关闭窗口会隐藏到 Dock，从程序坞点回。此开关仅 Windows / Linux 有效。'
                : '打开后，关闭主窗口会隐藏到托盘，不会退出。'
            }}
          </a-typography-paragraph>
        </a-form-item>
        <a-form-item label="开机自启">
          <a-switch :checked="store.settings.behavior.openAtLogin" @change="onLogin" />
        </a-form-item>
      </a-form>
    </a-card>
    <a-card title="快捷键">
      <a-form layout="vertical">
        <a-form-item label="显示 / 隐藏窗口">
          <a-input v-model:value="shortcutDraft.toggleWindow" />
        </a-form-item>
        <a-form-item label="打开剪贴板">
          <a-input v-model:value="shortcutDraft.clipboard" />
        </a-form-item>
        <a-form-item label="打开笔记">
          <a-input v-model:value="shortcutDraft.notes" />
        </a-form-item>
        <a-button type="primary" @click="saveShortcuts">保存快捷键</a-button>
        <a-typography-paragraph type="secondary" class="settings-hint">
          格式如 CommandOrControl+Shift+L。冲突时主进程会记日志。
        </a-typography-paragraph>
      </a-form>
    </a-card>
    <a-card title="协议">
      <a-space>
        <a-button type="primary" :loading="protocolBusy" @click="registerProtocol">
          注册 electron-lab://
        </a-button>
        <span>{{ protocolRegistered ? '已登记' : '未登记' }}</span>
      </a-space>
    </a-card>
    <a-card title="更新">
      <a-form layout="vertical">
        <a-form-item label="启动后自动检查">
          <a-switch :checked="store.settings.updater.autoCheck" @change="onAutoCheck" />
        </a-form-item>
        <a-form-item label="发现更新后自动下载">
          <a-switch :checked="store.settings.updater.autoDownload" @change="onAutoDownload" />
        </a-form-item>
      </a-form>
    </a-card>
    <a-card title="存储">
      <a-space>
        <a-button @click="exportDb">导出数据库</a-button>
        <a-button danger @click="clearDb">清空业务表</a-button>
      </a-space>
    </a-card>
  </a-space>
</template>

<style scoped>
.settings-hint {
  margin-top: 8px;
  margin-bottom: 0;
}
</style>
