import { registerAppIpc } from './app'
import { registerClipboardIpc } from './clipboard'
import { registerFilesIpc } from './files'
import { registerNotesIpc } from './notes'
import { registerSystemIpc } from './system'
import { registerWindowsIpc } from './windows'

export function registerIpc(): void {
  registerAppIpc()
  registerNotesIpc()
  registerClipboardIpc()
  registerFilesIpc()
  registerSystemIpc()
  registerWindowsIpc()
}
