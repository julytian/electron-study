import { describe, expect, it } from 'vitest'
import { collectFailedAccelerators, isAcceleratorShape } from '../src/main/services/shortcut-bind'

const shortcuts = {
  toggleWindow: 'CommandOrControl+Shift+L',
  clipboard: 'CommandOrControl+Shift+C',
  notes: 'CommandOrControl+Shift+N'
}

describe('isAcceleratorShape', () => {
  it('accepts Electron-style accelerators', () => {
    expect(isAcceleratorShape('CommandOrControl+Shift+L')).toBe(true)
    expect(isAcceleratorShape('Alt+Space')).toBe(true)
  })

  it('rejects empty or plain words', () => {
    expect(isAcceleratorShape('')).toBe(false)
    expect(isAcceleratorShape('  ')).toBe(false)
    expect(isAcceleratorShape('hello')).toBe(false)
  })
})

describe('collectFailedAccelerators', () => {
  it('returns accelerators that fail to register', () => {
    const failed = collectFailedAccelerators(shortcuts, (accelerator) => {
      return accelerator !== shortcuts.clipboard
    })
    expect(failed).toEqual([shortcuts.clipboard])
  })

  it('treats thrown register calls as failures', () => {
    const failed = collectFailedAccelerators(shortcuts, () => {
      throw new Error('taken')
    })
    expect(failed).toEqual([
      shortcuts.toggleWindow,
      shortcuts.clipboard,
      shortcuts.notes
    ])
  })

  it('returns an empty list when every shortcut registers', () => {
    expect(collectFailedAccelerators(shortcuts, () => true)).toEqual([])
  })
})
