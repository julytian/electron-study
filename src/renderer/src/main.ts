import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import App from './App.vue'
import { router } from './router'

window.addEventListener('message', (event) => {
  if (event.data !== 'port') return
  const port = event.ports[0]
  if (!port) return
  port.onmessage = (msg) => {
    window.dispatchEvent(new CustomEvent('lab-port', { detail: msg.data }))
  }
  window.__labPort = port
})

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(Antd)
app.mount('#app')

window.api.on('deep-link:open', (payload) => {
  if (payload.kind === 'note') {
    void router.push(`/workbench/notes?id=${payload.id}`)
  }
})
