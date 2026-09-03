import { registerAppIpc } from './app'
import { registerNotesIpc } from './notes'

export function registerIpc(): void {
  registerAppIpc()
  registerNotesIpc()
}
