export function platformError(message: string): Error {
  const text = message.includes('E_PLATFORM') ? message : `E_PLATFORM: ${message}`
  return Object.assign(new Error(text), { name: 'E_PLATFORM' })
}
