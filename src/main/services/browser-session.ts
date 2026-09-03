import { session } from 'electron'

let browserSession: Electron.Session | null = null

export function getBrowserSession(): Electron.Session {
  if (browserSession) return browserSession
  const ses = session.fromPartition('persist:browser')
  ses.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })
  browserSession = ses
  return ses
}
