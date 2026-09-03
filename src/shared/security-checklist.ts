export interface SecurityChecklistRow {
  id: string
  title: string
  file: string
  detail: string
}

export const SECURITY_CHECKLIST: SecurityChecklistRow[] = [
  {
    id: 'sandbox',
    title: '窗口沙箱',
    file: 'src/main/windows/main.ts',
    detail: 'BrowserWindow 开启 sandbox，渲染进程不能直接碰 Node。'
  },
  {
    id: 'context-isolation',
    title: '上下文隔离',
    file: 'src/main/windows/main.ts',
    detail: 'contextIsolation 为 true，页面只能走 preload 白名单。'
  },
  {
    id: 'no-node',
    title: '渲染进程无 Node',
    file: 'src/main/windows/main.ts',
    detail: 'nodeIntegration 关闭，页面里没有 require。'
  },
  {
    id: 'permission-check',
    title: 'Session 权限检查',
    file: 'src/main/services/session-permissions.ts',
    detail: 'request 与 check 共用白名单；浏览器分区一律拒绝。'
  },
  {
    id: 'navigation',
    title: '导航与重定向',
    file: 'src/main/windows/navigation.ts',
    detail: 'will-navigate 与 will-redirect 共用同一套允许规则。'
  },
  {
    id: 'no-webview',
    title: '拒绝 webview',
    file: 'src/main/services/session-security.ts',
    detail: 'will-attach-webview 一律 preventDefault。'
  },
  {
    id: 'csp',
    title: 'CSP meta 与正式包响应头',
    file: 'src/renderer/index.html',
    detail: '开发态靠 meta；正式包再给 defaultSession 加同一条响应头。'
  },
  {
    id: 'fuses',
    title: 'Electron Fuses 声明',
    file: 'electron-builder.yml',
    detail: '打包时按声明关闭 runAsNode、只从 asar 加载等。'
  }
]
