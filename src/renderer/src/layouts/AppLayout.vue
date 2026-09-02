<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { theme } from 'ant-design-vue'
import { routeGroups } from '@shared/routes'
import { useAppStore } from '../stores/app'
import CommandPalette from '../components/CommandPalette.vue'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const selected = computed(() => [route.path])
const isDark = computed(() => {
  const mode = store.settings.appearance.theme
  if (mode === 'dark') return true
  if (mode === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
})

const algorithm = computed(() => (isDark.value ? theme.darkAlgorithm : theme.defaultAlgorithm))
</script>

<template>
  <a-config-provider :theme="{ algorithm }">
    <a-layout style="min-height: 100vh">
      <a-layout-sider width="240" breakpoint="lg" collapsible>
        <div style="padding: 16px; color: #fff; font-weight: 600">Electron Lab</div>
        <a-menu
          mode="inline"
          :selected-keys="selected"
          @click="({ key }) => router.push(String(key))"
        >
          <a-sub-menu v-for="group in routeGroups" :key="group.key" :title="group.title">
            <a-menu-item v-for="item in group.items" :key="item.path">
              {{ item.title }}
            </a-menu-item>
          </a-sub-menu>
        </a-menu>
      </a-layout-sider>
      <a-layout>
        <a-layout-content style="padding: 16px">
          <RouterView />
        </a-layout-content>
        <a-layout-footer style="padding: 8px 16px">
          {{ store.info?.platform }} · Electron {{ store.info?.electron }} · 更新
          {{ store.updaterStatus }} · DB
          {{ store.info?.dbReady ? '就绪' : '未就绪' }}
        </a-layout-footer>
      </a-layout>
    </a-layout>
    <CommandPalette />
  </a-config-provider>
</template>
