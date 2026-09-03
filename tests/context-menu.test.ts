import { describe, expect, it } from 'vitest'
import { isDevtoolsMenuRole } from '../src/main/windows/app-menu'
import { buildPackagedContextMenuTemplate } from '../src/main/windows/window-security'

function flatten(
  items: Array<{ role?: string; label?: string; submenu?: Array<{ role?: string; label?: string }> }>
): Array<{ role?: string; label?: string }> {
  return items.flatMap((item) => [item, ...(item.submenu ?? [])])
}

describe('buildPackagedContextMenuTemplate', () => {
  it('has edit roles and no inspect or toggleDevTools', () => {
    const flat = flatten(buildPackagedContextMenuTemplate())
    expect(flat.map((item) => item.role)).toEqual([
      'undo',
      'redo',
      'cut',
      'copy',
      'paste',
      'selectAll'
    ])
    for (const item of flat) {
      expect(isDevtoolsMenuRole(item.role)).toBe(false)
      expect(item.label?.includes('检查') ?? false).toBe(false)
      expect(item.label?.includes('Toggle Developer Tools') ?? false).toBe(false)
    }
  })
})
