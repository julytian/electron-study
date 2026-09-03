<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { errorCodes } from '@shared/ipc-result'
import { invokeIpc } from '../../composables/useIpc'
import { useAppStore } from '../../stores/app'

const store = useAppStore()
const lastMessage = shallowRef('')
const touchBarHint = shallowRef('')
const running = shallowRef<'jump-list' | 'dock' | 'touchbar' | ''>('')

const platform = computed(
  () => store.info?.platform ?? (typeof process !== 'undefined' ? process.platform : undefined)
)
const isWindows = computed(() => platform.value === 'win32')
const isMac = computed(() => platform.value === 'darwin')

async function runPlatform(
  action: 'refresh-jump-list' | 'refresh-dock' | 'set-touchbar'
): Promise<void> {
  const key =
    action === 'refresh-jump-list' ? 'jump-list' : action === 'refresh-dock' ? 'dock' : 'touchbar'
  running.value = key
  lastMessage.value = ''
  if (action === 'set-touchbar') touchBarHint.value = ''
  try {
    const data = await invokeIpc('lab:run', 'platform', action)
    lastMessage.value = data.message
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : ''
    if (action === 'set-touchbar' && code === errorCodes.PLATFORM) {
      touchBarHint.value = '当前设备无 TouchBar'
    }
  } finally {
    running.value = ''
  }
}
</script>

<template>
  <a-space direction="vertical" class="platform-lab" :size="16">
    <a-card title="说明">
      <a-typography>
        <a-typography-paragraph>
          Windows 可用 Jump List、User Tasks 和任务栏缩略图按钮；macOS 可用 Dock 菜单和
          TouchBar。入口始终可见，当前系统不支持的按钮会禁用并说明原因。
        </a-typography-paragraph>
        <a-typography-paragraph>
          Jump List 的「最近文件」只收录
          <a-typography-text code>recent_files</a-typography-text>
          里仍然存在的路径。可先到
          <RouterLink to="/workbench/files">文件与拖放</RouterLink>
          打开几个文件再刷新。
        </a-typography-paragraph>
      </a-typography>
    </a-card>

    <a-card title="演示">
      <a-space direction="vertical" class="platform-lab" :size="16">
        <a-alert type="info" show-icon :message="`当前平台：${platform ?? '未知'}`" />
        <a-form layout="vertical">
          <a-form-item label="Windows">
            <a-space direction="vertical" :size="8">
              <a-button
                type="primary"
                :disabled="!isWindows"
                :loading="running === 'jump-list'"
                @click="runPlatform('refresh-jump-list')"
              >
                刷新 Jump List / User Tasks / 缩略图按钮
              </a-button>
              <a-typography-paragraph v-if="!isWindows" type="secondary" class="platform-lab-hint">
                仅 Windows
              </a-typography-paragraph>
            </a-space>
          </a-form-item>
          <a-form-item label="macOS">
            <a-space direction="vertical" :size="8">
              <a-space>
                <a-button
                  :disabled="!isMac"
                  :loading="running === 'dock'"
                  @click="runPlatform('refresh-dock')"
                >
                  刷新 Dock 菜单
                </a-button>
                <a-button
                  :disabled="!isMac"
                  :loading="running === 'touchbar'"
                  @click="runPlatform('set-touchbar')"
                >
                  设置 TouchBar
                </a-button>
              </a-space>
              <a-typography-paragraph v-if="!isMac" type="secondary" class="platform-lab-hint">
                仅 macOS
              </a-typography-paragraph>
              <a-typography-paragraph v-if="touchBarHint" type="warning" class="platform-lab-hint">
                {{ touchBarHint }}
              </a-typography-paragraph>
            </a-space>
          </a-form-item>
        </a-form>
        <a-typography-paragraph v-if="lastMessage" type="success">
          {{ lastMessage }}
        </a-typography-paragraph>
      </a-space>
    </a-card>

    <a-card title="要点">
      <ul class="platform-lab-list">
        <li>
          Windows 用
          <a-typography-text code>app.setJumpList</a-typography-text>
          自定义「最近文件」，
          <a-typography-text code>app.setUserTasks</a-typography-text>
          放一条打开主窗口的任务；缩略图按钮走
          <a-typography-text code>BrowserWindow.setThumbarButtons</a-typography-text>
          ，不支持则忽略。
        </li>
        <li>
          macOS 用
          <a-typography-text code>app.dock.setMenu</a-typography-text>
          跳到笔记 / 剪贴板。TouchBar 仅在
          <a-typography-text code>typeof TouchBar !== 'undefined'</a-typography-text>
          且创建成功时挂到主窗口。
        </li>
        <li>
          渲染进程只调用
          <a-typography-text code>lab:run</a-typography-text>
          的
          <a-typography-text code>platform</a-typography-text>
          动作，不直接碰 Electron 平台 API。
        </li>
      </ul>
    </a-card>

    <a-card title="安全注意">
      <ul class="platform-lab-list">
        <li>平台 API 只在主进程调用。渲染进程没有 Node，也看不到 Jump List / Dock 对象。</li>
        <li>最近文件只读库里的路径，并且用存在性检查过滤，避免指向已删除文件。</li>
        <li>非本平台动作返回 E_PLATFORM，不要当成成功静默吞掉。</li>
      </ul>
    </a-card>
  </a-space>
</template>

<style scoped>
.platform-lab {
  width: 100%;
}

.platform-lab-hint {
  margin: 8px 0 0;
}

.platform-lab-list {
  margin: 0;
  padding-inline-start: 1.25rem;
}

.platform-lab-list li + li {
  margin-top: 8px;
}
</style>
