import { registerAppIpc } from './app'
import { registerBrowserIpc } from './browser'
import { registerClipboardIpc } from './clipboard'
import { registerDownloadsIpc } from './downloads'
import { registerFilesIpc } from './files'
import { registerNotesIpc } from './notes'
import { registerProtocolIpc } from './protocol'
import { registerSystemIpc } from './system'
import { registerWindowsIpc } from './windows'

export function registerIpc(): void {
  registerAppIpc()
  registerNotesIpc()
  registerClipboardIpc()
  registerFilesIpc()
  registerDownloadsIpc()
  registerSystemIpc()
  registerWindowsIpc()
  registerBrowserIpc()
  registerProtocolIpc()
}
