export interface MenuItemLike {
  role?: string
  label?: string
  submenu?: MenuItemLike[]
}

export function isDevtoolsMenuRole(role: string | undefined): boolean {
  return role?.toLowerCase() === 'toggledevtools'
}

function isDevtoolsMenuLabel(label: string | undefined): boolean {
  if (!label) return false
  return label.includes('Toggle Developer Tools') || label.includes('检查元素')
}

export function withoutDevtoolsMenuItems(items: MenuItemLike[]): MenuItemLike[] {
  const next: MenuItemLike[] = []
  for (const item of items) {
    if (isDevtoolsMenuRole(item.role) || isDevtoolsMenuLabel(item.label)) continue
    if (item.submenu) {
      const submenu = withoutDevtoolsMenuItems(item.submenu)
      if (submenu.length === 0) continue
      next.push({ ...item, submenu })
      continue
    }
    next.push(item)
  }
  return next
}

export function buildPackagedMenuTemplate(): MenuItemLike[] {
  const edit: MenuItemLike = {
    label: '编辑',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' }
    ]
  }
  const windowMenu: MenuItemLike = {
    label: '窗口',
    submenu: [{ role: 'minimize' }, { role: 'close' }]
  }
  const help: MenuItemLike = {
    label: '帮助',
    submenu: [{ label: '打开仓库' }]
  }
  if (process.platform === 'darwin') {
    return [
      {
        label: 'Electron Lab',
        submenu: [{ role: 'about' }, { role: 'hide' }, { role: 'quit' }]
      },
      edit,
      windowMenu,
      help
    ]
  }
  return [edit, windowMenu, help]
}
