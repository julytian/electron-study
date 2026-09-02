export interface RouteItem {
  path: string
  title: string
}

export interface RouteGroup {
  key: 'workbench' | 'windows' | 'browser' | 'lab' | 'settings'
  title: string
  items: RouteItem[]
}

export const routeGroups: RouteGroup[] = [
  {
    key: 'workbench',
    title: '工作台',
    items: [
      { path: '/workbench/clipboard', title: '剪贴板工作台' },
      { path: '/workbench/notes', title: '本地笔记' },
      { path: '/workbench/files', title: '文件与拖放' },
      { path: '/workbench/capture', title: '截图与桌面捕获' },
      { path: '/workbench/downloads', title: '下载中心' },
      { path: '/workbench/print', title: '打印与 PDF' },
      { path: '/workbench/system', title: '系统能力' }
    ]
  },
  {
    key: 'windows',
    title: '窗口中心',
    items: [
      { path: '/windows/lab', title: '窗口实验室' },
      { path: '/windows/chrome', title: '现代窗口外观' },
      { path: '/windows/ports', title: '跨窗口通信' }
    ]
  },
  {
    key: 'browser',
    title: '浏览',
    items: [{ path: '/browser', title: '迷你浏览器' }]
  },
  {
    key: 'lab',
    title: '实验室',
    items: [
      { path: '/lab/security', title: '进程与安全' },
      { path: '/lab/window', title: '窗口与视图' },
      { path: '/lab/desktop', title: '系统与桌面' },
      { path: '/lab/files', title: '文件与网络' },
      { path: '/lab/media', title: '媒体与捕获' },
      { path: '/lab/native-ui', title: '原生 UI' },
      { path: '/lab/protocol', title: '深链与文件关联' },
      { path: '/lab/network', title: '网络拦截与代理' },
      { path: '/lab/platform', title: '平台集成' },
      { path: '/lab/safe-storage', title: '安全存储' },
      { path: '/lab/metrics', title: '进程与性能' },
      { path: '/lab/advanced', title: '进阶' }
    ]
  },
  {
    key: 'settings',
    title: '设置',
    items: [
      { path: '/settings', title: '设置' },
      { path: '/about', title: '关于 / 诊断' }
    ]
  }
]
