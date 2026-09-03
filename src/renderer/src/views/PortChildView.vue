<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useLabPort } from '../composables/useLabPort'

const route = useRoute()
const side = route.path.endsWith('/right') ? 'right' : 'left'
const { messages, draft, send } = useLabPort(side)
const title = computed(() => (side === 'left' ? '左窗' : '右窗'))
</script>

<template>
  <a-space direction="vertical" class="port-child" :size="16">
    <a-card :title="`${title} · MessagePort`">
      <a-space direction="vertical" :size="12" class="port-child">
        <a-list :data-source="messages" size="small" bordered>
          <template #renderItem="{ item }">
            <a-list-item>
              <strong>{{ item.side === 'left' ? '左' : '右' }}</strong>
              ：{{ item.text }}
            </a-list-item>
          </template>
          <template #header>消息</template>
        </a-list>
        <a-space class="port-child">
          <a-input v-model:value="draft" :placeholder="`在${title}发送`" @press-enter="send" />
          <a-button type="primary" @click="send">发送</a-button>
        </a-space>
      </a-space>
    </a-card>
  </a-space>
</template>

<style scoped>
.port-child {
  width: 100%;
}
</style>
