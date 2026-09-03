import { transformExportPayload } from './export-transform'

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => {
      data += chunk
    })
    process.stdin.on('end', () => resolve(data))
    process.stdin.on('error', reject)
  })
}

async function readInput(): Promise<{ text: string; times?: number }> {
  const fromArg = process.argv[2]
  if (fromArg) {
    return JSON.parse(fromArg) as { text: string; times?: number }
  }
  const raw = await readStdin()
  return JSON.parse(raw) as { text: string; times?: number }
}

async function main(): Promise<void> {
  try {
    const input = await readInput()
    const result = transformExportPayload(input)
    console.log(JSON.stringify(result))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    process.exit(1)
  }
}

void main()
