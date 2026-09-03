import { describe, expect, it } from 'vitest'
import {
  isDevtoolsMenuRole,
  withoutDevtoolsMenuItems,
  type MenuItemLike
} from '../src/main/windows/app-menu'

describe('isDevtoolsMenuRole', () => {
  it('matches toggleDevTools case-insensitively', () => {
    expect(isDevtoolsMenuRole('toggleDevTools')).toBe(true)
    expect(isDevtoolsMenuRole('toggledevtools')).toBe(true)
    expect(isDevtoolsMenuRole('reload')).toBe(false)
    expect(isDevtoolsMenuRole('quit')).toBe(false)
    expect(isDevtoolsMenuRole(undefined)).toBe(false)
  })
})

describe('withoutDevtoolsMenuItems', () => {
  it('strips nested toggleDevTools and inspect labels, keeps reload', () => {
    const input: MenuItemLike[] = [
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'toggleDevTools' },
          { label: '检查元素' },
          { label: 'Toggle Developer Tools' }
        ]
      },
      {
        label: 'EmptyDev',
        submenu: [{ role: 'toggledevtools' }]
      }
    ]
    expect(withoutDevtoolsMenuItems(input)).toEqual([
      {
        label: 'View',
        submenu: [{ role: 'reload' }]
      }
    ])
  })
})
