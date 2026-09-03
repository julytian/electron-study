export interface ShortcutMap {
  toggleWindow: string
  clipboard: string
  notes: string
}

export { isAcceleratorShape } from '../../shared/accelerator'

export function collectFailedAccelerators(
  shortcuts: ShortcutMap,
  register: (accelerator: string) => boolean
): string[] {
  const failed: string[] = []
  for (const accelerator of [shortcuts.toggleWindow, shortcuts.clipboard, shortcuts.notes]) {
    let ok = false
    try {
      ok = register(accelerator)
    } catch {
      ok = false
    }
    if (!ok) failed.push(accelerator)
  }
  return failed
}
