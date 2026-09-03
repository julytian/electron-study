import { registerAppIpc } from './app'
import { registerClipboardIpc } from './clipboard'
import { registerFilesIpc } from './files'
import { registerNotesIpc } from './notes'
import { registerSystemIpc } from './system'

export function registerIpc(): void {
  registerAppIpc()
  registerNotesIpc()
  registerClipboardIpc()
  registerFilesIpc()
  registerSystemIpc()
}
