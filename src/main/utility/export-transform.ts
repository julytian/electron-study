export function transformExportPayload(input: { text: string; times?: number }): { text: string } {
  const times = input.times ?? 1
  let text = ''
  for (let i = 0; i < times; i++) {
    text += input.text.toUpperCase()
  }
  return { text: `${text}#${text.length}` }
}
