import { createRouter, createWebHashHistory } from 'vue-router'
import { routeGroups } from '@shared/routes'
import AppLayout from '../layouts/AppLayout.vue'
import PlaceholderView from '../views/PlaceholderView.vue'
import SettingsView from '../views/SettingsView.vue'
import AboutView from '../views/AboutView.vue'
import NotesView from '../views/NotesView.vue'
import ClipboardView from '../views/ClipboardView.vue'
import FilesView from '../views/FilesView.vue'
import SystemView from '../views/SystemView.vue'
import WindowLabView from '../views/WindowLabView.vue'
import WindowChromeView from '../views/WindowChromeView.vue'
import WindowPortsView from '../views/WindowPortsView.vue'
import PortChildView from '../views/PortChildView.vue'
import BrowserView from '../views/BrowserView.vue'
import DownloadsView from '../views/DownloadsView.vue'
import PrintView from '../views/PrintView.vue'
import CaptureView from '../views/CaptureView.vue'

const children = routeGroups.flatMap((group) =>
  group.items.map((item) => {
    if (item.path === '/settings') {
      return { path: item.path, component: SettingsView }
    }
    if (item.path === '/about') {
      return { path: item.path, component: AboutView }
    }
    if (item.path === '/workbench/notes') {
      return { path: item.path, component: NotesView }
    }
    if (item.path === '/workbench/clipboard') {
      return { path: item.path, component: ClipboardView }
    }
    if (item.path === '/workbench/files') {
      return { path: item.path, component: FilesView }
    }
    if (item.path === '/workbench/system') {
      return { path: item.path, component: SystemView }
    }
    if (item.path === '/windows/lab') {
      return { path: item.path, component: WindowLabView }
    }
    if (item.path === '/windows/chrome') {
      return { path: item.path, component: WindowChromeView }
    }
    if (item.path === '/windows/ports') {
      return { path: item.path, component: WindowPortsView }
    }
    if (item.path === '/browser') {
      return { path: item.path, component: BrowserView }
    }
    if (item.path === '/workbench/downloads') {
      return { path: item.path, component: DownloadsView }
    }
    if (item.path === '/workbench/print') {
      return { path: item.path, component: PrintView }
    }
    if (item.path === '/workbench/capture') {
      return { path: item.path, component: CaptureView }
    }
    return { path: item.path, component: PlaceholderView }
  })
)

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      component: AppLayout,
      redirect: '/workbench/notes',
      children
    },
    { path: '/ports/left', component: PortChildView },
    { path: '/ports/right', component: PortChildView },
    { path: '/:pathMatch(.*)*', redirect: '/workbench/notes' }
  ]
})
