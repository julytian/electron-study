import { registerAppIpc } from './app'
import { registerBrowserIpc } from './browser'
import { registerClipboardIpc } from './clipboard'
import { registerDownloadsIpc } from './downloads'
import { registerFilesIpc } from './files'
import { registerLabIpc } from './lab'
import { registerNotesIpc } from './notes'
import { registerProtocolIpc } from './protocol'
import { registerSystemIpc } from './system'
import { registerUpdaterIpc } from './updater'
import { registerWindowsIpc } from './windows'

export function registerIpc(): void {
  registerUpdaterIpc()
  registerAppIpc()
  registerNotesIpc()
  registerClipboardIpc()
  registerFilesIpc()
  registerDownloadsIpc()
  registerSystemIpc()
  registerWindowsIpc()
  registerBrowserIpc()
  registerProtocolIpc()
  registerLabIpc()
}
