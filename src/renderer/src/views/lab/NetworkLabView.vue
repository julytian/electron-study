<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { invokeIpc } from '../../composables/useIpc'
import { useAppStore } from '../../stores/app'

const store = useAppStore()
const filterEnabled = shallowRef(false)
const proxyRules = shallowRef('')
const allowInsecure = shallowRef(false)
const proxyBusy = shallowRef(false)

const packaged = computed(() => store.info?.isPackaged ?? false)

async function setFilter(enabled: boolean): Promise<void> {
  const previous = filterEnabled.value
  filterEnabled.value = enabled
  try {
    await invokeIpc('network:set-filter', enabled)
  } catch {
    filterEnabled.value = previous
  }
}

async function applyProxy(): Promise<void> {
  proxyBusy.value = true
  try {
    await invokeIpc('network:set-proxy', proxyRules.value.trim())
  } catch {
    // invokeIpc 已 toast
  } finally {
    proxyBusy.value = false
  }
}

async function setInsecure(enabled: boolean): Promise<void> {
  if (packaged.value) return
  const previous = allowInsecure.value
  allowInsecure.value = enabled
  try {
    await invokeIpc('network:set-insecure-certs', enabled)
  } catch {
    allowInsecure.value = previous
  }
}
</script>

<template>
  <a-space direction="vertical" class="network-lab" :size="16">
    <a-card title="说明">
      <a-typography>
        <a-typography-paragraph>
          演示
          <a-typography-text code>webRequest</a-typography-text>
          拦截、
          <a-typography-text code>setProxy</a-typography-text>
          与证书校验。效果只作用在迷你浏览器的
          <a-typography-text code>persist:browser</a-typography-text>
          Session，不会改主界面使用的 defaultSession。
        </a-typography-paragraph>
        <a-typography-paragraph>
          请先打开
          <RouterLink to="/browser">迷你浏览器</RouterLink>
          ，再回到本页拨开关或填写代理。
        </a-typography-paragraph>
      </a-typography>
    </a-card>

    <a-card title="演示">
      <a-space direction="vertical" class="network-lab" :size="16">
        <a-alert type="info" show-icon message="请先打开迷你浏览器。下列设置只影响迷你浏览器 Session。" />
        <a-form layout="vertical">
          <a-form-item label="拦截 blocked.example">
            <a-switch :checked="filterEnabled" @change="setFilter" />
            <a-typography-paragraph type="secondary" class="network-lab-hint">
              打开后，迷你浏览器里访问含
              <a-typography-text code>blocked.example</a-typography-text>
              的 https 地址会被取消。
            </a-typography-paragraph>
          </a-form-item>
          <a-form-item label="代理规则">
            <a-space class="network-lab-proxy" :size="8">
              <a-input
                v-model:value="proxyRules"
                placeholder="例如 http://127.0.0.1:7890，留空表示直连"
                allow-clear
                @press-enter="applyProxy"
              />
              <a-button type="primary" :loading="proxyBusy" @click="applyProxy">应用代理</a-button>
            </a-space>
          </a-form-item>
          <a-form-item label="允许自签证书">
            <a-switch :checked="allowInsecure" :disabled="packaged" @change="setInsecure" />
            <a-typography-paragraph type="secondary" class="network-lab-hint">
              {{
                packaged
                  ? '正式包已禁用该开关，始终走系统证书校验。'
                  : '仅开发态可用。打开后 persist:browser 会放行自签证书。'
              }}
            </a-typography-paragraph>
          </a-form-item>
        </a-form>
      </a-space>
    </a-card>

    <a-card title="要点">
      <ul class="network-lab-list">
        <li>
          过滤、代理、证书全部调用
          <a-typography-text code>session.fromPartition('persist:browser')</a-typography-text>
          ，不要碰
          <a-typography-text code>session.defaultSession</a-typography-text>
          。
        </li>
        <li>
          过滤打开时用
          <a-typography-text code>webRequest.onBeforeRequest</a-typography-text>
          ，匹配
          <a-typography-text code>https://*/*</a-typography-text>
          ；关闭时传入
          <a-typography-text code>null</a-typography-text>
          移除监听。
        </li>
        <li>
          代理走
          <a-typography-text code>ses.setProxy({ proxyRules })</a-typography-text>
          。
        </li>
        <li>
          证书默认
          <a-typography-text code>callback(-3)</a-typography-text>
          走 Chromium / 系统校验；仅开发态开关打开才
          <a-typography-text code>callback(0)</a-typography-text>
          。
        </li>
      </ul>
    </a-card>

    <a-card title="安全注意">
      <ul class="network-lab-list">
        <li>正式打包应用不得关闭证书校验。渲染进程若请求开启，主进程返回 E_PLATFORM。</li>
        <li>拦截与代理若打到 defaultSession，会污染主窗口和所有未隔离页面。</li>
        <li>不要把「允许自签证书」做成面向用户的默认设置，只保留实验室开关。</li>
      </ul>
    </a-card>
  </a-space>
</template>

<style scoped>
.network-lab {
  width: 100%;
}

.network-lab-proxy {
  width: 100%;
}

.network-lab-proxy :deep(.ant-input-affix-wrapper),
.network-lab-proxy :deep(.ant-input) {
  min-width: 280px;
  flex: 1;
}

.network-lab-hint {
  margin: 8px 0 0;
}

.network-lab-list {
  margin: 0;
  padding-inline-start: 1.25rem;
}

.network-lab-list li + li {
  margin-top: 8px;
}
</style>
