<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { Modal } from 'ant-design-vue'
import { invokeIpc } from '../../composables/useIpc'
import { useAppStore } from '../../stores/app'

const store = useAppStore()
const registering = shallowRef(false)
const registered = computed(() => store.settings.protocol.registered)
const macDevCommand = 'open "electron-lab://note/1"'

async function confirmRegister(): Promise<void> {
  Modal.confirm({
    title: '注册 electron-lab:// 协议？',
    content: '会把本应用设为 electron-lab 协议的默认打开方式。开发态可能需要安装包后才完全生效。',
    async onOk() {
      await registerProtocol()
    }
  })
}

async function registerProtocol(): Promise<void> {
  registering.value = true
  try {
    await invokeIpc('protocol:register')
    store.settings.protocol.registered = true
  } catch {
    // invokeIpc 已 toast
  } finally {
    registering.value = false
  }
}
</script>

<template>
  <a-space direction="vertical" class="protocol-lab" :size="16">
    <a-card title="说明">
      <a-typography>
        <a-typography-paragraph>
          自定义协议
          <a-typography-text code>electron-lab://note/:id</a-typography-text>
          用来打开本地笔记。WHATWG URL 会把
          <a-typography-text code>electron-lab://note/12</a-typography-text>
          的 hostname 解析成
          <a-typography-text code>note</a-typography-text>
          。
        </a-typography-paragraph>
        <a-typography-paragraph>
          开发态未安装包时，macOS 可用
          <a-typography-text code>open "electron-lab://note/1"</a-typography-text>
          把深链交给正在跑的实例。安装后再测文件关联：双击
          <a-typography-text code>.md</a-typography-text>
          会读入最近文件；体积不超过 2MB 时会建成一条笔记。
        </a-typography-paragraph>
      </a-typography>
    </a-card>

    <a-card title="演示">
      <a-space direction="vertical" class="protocol-lab" :size="16">
        <a-alert
          type="info"
          show-icon
          message="注册协议后，第二次启动会走单实例锁；Windows / Linux 的 URL 在 second-instance 的 argv 里。"
        />
        <a-form layout="vertical">
          <a-form-item label="协议注册状态">
            <a-space>
              <a-tag :color="registered ? 'success' : 'default'">
                {{ registered ? '已登记' : '未登记' }}
              </a-tag>
              <a-button type="primary" :loading="registering" @click="confirmRegister">
                注册 electron-lab://
              </a-button>
            </a-space>
          </a-form-item>
          <a-form-item label="macOS 开发态手验">
            <a-typography-text :copyable="{ text: macDevCommand }" code>
              {{ macDevCommand }}
            </a-typography-text>
            <a-typography-paragraph type="secondary" class="protocol-lab-hint">
              先保证本应用已在跑，并至少有 id 为 1 的笔记。Windows 二次实例会把同一 URL 放进 argv。
            </a-typography-paragraph>
          </a-form-item>
        </a-form>
        <a-typography-paragraph type="secondary">
          非 Markdown 或超过 2MB 的关联文件只会写入
          <a-typography-text code>recent_files</a-typography-text>
          并聚焦窗口，不会新开 IPC 通道；可到
          <RouterLink to="/workbench/files">文件与拖放</RouterLink>
          查看说明。
        </a-typography-paragraph>
      </a-space>
    </a-card>

    <a-card title="要点">
      <ul class="protocol-lab-list">
        <li>
          macOS 用
          <a-typography-text code>app.on('open-url')</a-typography-text>
          ，必须在
          <a-typography-text code>whenReady</a-typography-text>
          之前监听。
        </li>
        <li>
          二次实例走
          <a-typography-text code>second-instance</a-typography-text>
          的
          <a-typography-text code>argv</a-typography-text>
          ，用
          <a-typography-text code>extractUrlFromArgv</a-typography-text>
          抽出
          <a-typography-text code>electron-lab://</a-typography-text>
          。
        </li>
        <li>
          主进程
          <a-typography-text code>parseDeepLink</a-typography-text>
          通过后发送
          <a-typography-text code>deep-link:open</a-typography-text>
          ；窗口未就绪则先入队。
        </li>
        <li>
          渲染进程订阅后
          <a-typography-text code>router.push('/workbench/notes?id=')</a-typography-text>
          ，
          <a-typography-text code>NotesView</a-typography-text>
          监听
          <a-typography-text code>route.query.id</a-typography-text>
          再
          <a-typography-text code>open(id)</a-typography-text>
          。
        </li>
        <li>
          <a-typography-text code>open-file</a-typography-text>
          在 darwin 上
          <a-typography-text code>preventDefault</a-typography-text>
          ；.md 建笔记，其它文件只记最近打开。
        </li>
      </ul>
    </a-card>

    <a-card title="安全注意">
      <ul class="protocol-lab-list">
        <li>
          只接受
          <a-typography-text code>electron-lab:</a-typography-text>
          ，拒绝
          <a-typography-text code>https:</a-typography-text>
          和其它协议。
        </li>
        <li>笔记 id 必须是数字，非数字路径直接丢弃。</li>
        <li>
          不要用
          <a-typography-text code>myapp://</a-typography-text>
          这种泛协议名，避免和别的应用抢注册。
        </li>
        <li>渲染进程不能自己拼自定义协议去读盘，只能走白名单 IPC 事件。</li>
      </ul>
    </a-card>
  </a-space>
</template>

<style scoped>
.protocol-lab {
  width: 100%;
}

.protocol-lab-hint {
  margin: 8px 0 0;
}

.protocol-lab-list {
  margin: 0;
  padding-inline-start: 1.25rem;
}

.protocol-lab-list li + li {
  margin-top: 8px;
}
</style>
