import { message } from 'ant-design-vue'
import type { InvokeChannel, InvokeMap } from '@shared/ipc'
import type { IpcResult } from '@shared/ipc-result'

export async function invokeIpc<C extends InvokeChannel>(
  channel: C,
  ...args: InvokeMap[C]['args']
): Promise<InvokeMap[C]['result']> {
  const result = (await window.api.invoke(channel, ...args)) as IpcResult<InvokeMap[C]['result']>
  if (!result.ok) {
    message.error(result.error.message)
    throw Object.assign(new Error(result.error.message), {
      code: result.error.code
    })
  }
  return result.data
}
