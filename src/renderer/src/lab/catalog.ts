export interface LabAction {
  id: string
  title: string
  danger?: boolean
}

export interface LabModule {
  path: string
  title: string
  summary: string
  tips: string
  safety: string
  actions: LabAction[]
}

export const labModules: LabModule[] = [
  {
    path: '/lab/security',
    title: '进程与安全',
    summary:
      '对照主进程、preload 与渲染进程的职责。渲染进程视为不可信，只能走白名单 IPC，不能直接碰 Node 或磁盘。',
    tips: '主进程管窗口、数据库和系统 API；preload 只做 contextBridge 转发；渲染进程只写界面。默认 sandbox、contextIsolation，nodeIntegration 关闭。',
    safety:
      '渲染进程里 typeof require === "undefined"。不要在页面里拼绝对路径读盘，也不要把整个 ipcRenderer 暴露出去。',
    actions: [
      { id: 'app-info', title: '查看应用与沙箱信息' },
      { id: 'security-status', title: '查看安全状态' }
    ]
  },
  {
    path: '/lab/window',
    title: '窗口与视图',
    summary: '子窗口由主进程创建。渲染进程只发业务命令，不持有窗口 ID 去随意操控。',
    tips: 'createChildWindow 在主进程执行，预加载脚本、沙箱和上下文隔离与主窗口一致。完整窗口实验见窗口中心。',
    safety: '不要从渲染进程创建 BrowserWindow。父窗口关闭时子窗口应一并销毁。',
    actions: [{ id: 'create-child', title: '创建子窗口' }]
  },
  {
    path: '/lab/desktop',
    title: '系统与桌面',
    summary: '通知、托盘、主题和电源等桌面能力都在主进程调用，页面只触发命令。',
    tips: '通知点击可回到指定路由。完整系统能力页在工作台。',
    safety: '系统 API 只在主进程使用。渲染进程不能直接 new Notification 访问原生能力。',
    actions: [{ id: 'notify', title: '发送系统通知' }]
  },
  {
    path: '/lab/files',
    title: '文件与网络',
    summary: '文件对话框、最近文件和 SQLite 都在主进程，路径必须落在允许的根目录内。',
    tips: '业务库路径在 userData。开发态目录带 -dev 后缀。打开/保存等完整操作见工作台文件页。',
    safety: '路径先 resolve 再校验，禁止任意绝对路径。渲染进程看不到 fs。',
    actions: [{ id: 'db-status', title: '查看数据库状态' }]
  },
  {
    path: '/lab/media',
    title: '媒体与捕获',
    summary: '屏幕和窗口捕获走 desktopCapturer，只在主进程取源列表。',
    tips: '完整截图与保存流程在工作台「截图与桌面捕获」。这里只统计当前可捕获源数量。',
    safety: '缩略图和源信息经 IPC 回传。不要在渲染进程直接调用桌面捕获 API。',
    actions: [{ id: 'sources-count', title: '统计捕获源' }]
  },
  {
    path: '/lab/native-ui',
    title: '原生 UI',
    summary: '菜单、对话框和平台控件都由主进程按当前操作系统提供。',
    tips: 'Jump List、Dock、TouchBar 在平台集成页。这里先确认 process.platform。',
    safety: '当前系统没有的能力应禁用并说明，不要假装成功。',
    actions: [{ id: 'platform', title: '查看当前平台' }]
  },
  {
    path: '/lab/protocol',
    title: '深链与文件关联',
    summary: '协议名为 electron-lab://。系统深链经主进程校验后再路由到笔记。',
    tips: '完整注册与 macOS 开发态命令见本页独立界面。笔记深链形如 electron-lab://note/12。',
    safety: '只处理已校验的 URL。二次实例把 argv 交给已有窗口，不新开进程。',
    actions: [{ id: 'status', title: '查看协议注册状态' }]
  },
  {
    path: '/lab/network',
    title: '网络拦截与代理',
    summary: 'webRequest、代理和证书策略只作用在迷你浏览器的独立 Session。',
    tips: '完整开关在本页独立界面。主界面仍走 defaultSession。',
    safety: 'persist:browser 与主窗口隔离，cookie 和拦截规则互不影响。正式包不允许关闭证书校验。',
    actions: [{ id: 'isolation', title: '查看 Session 隔离说明' }]
  },
  {
    path: '/lab/platform',
    title: '平台集成',
    summary: 'Windows 的 Jump List / User Tasks，macOS 的 Dock 菜单与 TouchBar。',
    tips: '入口始终可见。非本平台动作返回 E_PLATFORM。完整按钮状态见独立界面。',
    safety: '平台 API 只在主进程调用。最近文件只收录库里仍然存在的路径。',
    actions: [
      { id: 'refresh-jump-list', title: '刷新 Jump List' },
      { id: 'refresh-dock', title: '刷新 Dock 菜单' },
      { id: 'set-touchbar', title: '设置 TouchBar' }
    ]
  },
  {
    path: '/lab/safe-storage',
    title: '安全存储',
    summary: 'safeStorage 用系统钥匙串/凭据保护加密密钥，笔记可选加密落库。',
    tips: '先探测 isEncryptionAvailable。加密笔记在 app.db 中不应出现明文正文。',
    safety: '密钥与加解密只在主进程。渲染进程只拿解密后的业务字段，不接触密钥。',
    actions: [{ id: 'probe', title: '探测系统加密' }]
  },
  {
    path: '/lab/metrics',
    title: '进程与性能',
    summary: '用 app.getAppMetrics() 列出当前 Electron 进程的 CPU 与内存。',
    tips: '完整表格在性能页。也可在此刷新一份摘要。',
    safety: '指标只读。不要在渲染进程猜测其它进程的 pid 去做系统操作。',
    actions: [
      { id: 'refresh', title: '刷新进程摘要' },
      { id: 'recent-gone', title: '查看最近进程事件' }
    ]
  },
  {
    path: '/lab/advanced',
    title: '进阶',
    summary: '更新 mock、utilityProcess 导出、以及仅开发态可用的崩溃演示。',
    tips: 'utilityProcess 在独立进程做字符串处理，避免堵住主进程。更新五态仍可用本页的 updater:mock 按钮。',
    safety:
      'crash-main 仅开发态抛错演示，正式包禁用。crashReporter 只在 packaged 启动且不上传。生产不要调用 process.crash() 或退出应用。',
    actions: [
      { id: 'utility-export', title: '运行 utilityProcess 导出' },
      { id: 'crash-dumps', title: '查看崩溃转储目录' },
      { id: 'crash-main', title: '触发主进程演示异常', danger: true }
    ]
  }
]
