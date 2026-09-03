import { describe, expect, it } from 'vitest'
import { collectFailedAccelerators } from '../src/main/services/shortcut-bind'

const shortcuts = {
  toggleWindow: 'CommandOrControl+Shift+L',
  clipboard: 'CommandOrControl+Shift+C',
  notes: 'CommandOrControl+Shift+N'
}

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
