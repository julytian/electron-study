import { createRouter, createWebHashHistory } from 'vue-router'
import { routeGroups } from '@shared/routes'
import AppLayout from '../layouts/AppLayout.vue'
import PlaceholderView from '../views/PlaceholderView.vue'
import SettingsView from '../views/SettingsView.vue'
import AboutView from '../views/AboutView.vue'
import NotesView from '../views/NotesView.vue'

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
    { path: '/:pathMatch(.*)*', redirect: '/workbench/notes' }
  ]
})
