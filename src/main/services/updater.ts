import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { UpdaterStatus } from '../../shared/models'

export interface UpdaterStatusPayload {
  status: UpdaterStatus
  version?: string
  message?: string
}

export interface UpdaterMachine {
  readonly status: UpdaterStatus
  readonly version?: string
  readonly message?: string
  mock(status: UpdaterStatus, extra?: Omit<UpdaterStatusPayload, 'status'>): void
  check(): { status: UpdaterStatus; version?: string }
  download(): void
  install(): 'quit' | 'noop'
  setStatus(status: UpdaterStatus, extra?: Omit<UpdaterStatusPayload, 'status'>): void
  onStatus(cb: (event: UpdaterStatusPayload) => void): () => void
}

const FAKE_VERSION = '1.0.1-mock'

export function parseGitHubRepository(
  repository: string | { url?: string } | undefined | null
): { owner: string; repo: string } | null {
  if (!repository) return null
  const raw = typeof repository === 'string' ? repository : repository.url
  if (!raw || typeof raw !== 'string') return null

  const trimmed = raw.trim()
  const patterns = [
    /github\.com[:/]([^/]+)\/([^/#?]+)/i,
    /^github:([^/]+)\/([^/#?]+)/i,
    /^([^/]+)\/([^/#?]+)$/
  ]

  for (const pattern of patterns) {
    const match = trimmed.match(pattern)
    if (!match?.[1] || !match[2]) continue
    const owner = match[1]
    const repo = match[2].replace(/\.git$/i, '')
    if (!owner || !repo) continue
    return { owner, repo }
  }

  return null
}

export function readPackageRepository(
  appPath: string
): { owner: string; repo: string } | null {
  try {
    const pkg = JSON.parse(readFileSync(join(appPath, 'package.json'), 'utf8')) as {
      repository?: string | { url?: string }
    }
    return parseGitHubRepository(pkg.repository)
  } catch {
    return null
  }
}

export function createUpdaterMachine(opts: { packaged: boolean }): UpdaterMachine {
  let status: UpdaterStatus = 'idle'
  let version: string | undefined
  let message: string | undefined
  const listeners = new Set<(event: UpdaterStatusPayload) => void>()

  function emit(): void {
    const event: UpdaterStatusPayload = { status }
    if (version !== undefined) event.version = version
    if (message !== undefined) event.message = message
    for (const listener of listeners) listener(event)
  }

  function setStatus(next: UpdaterStatus, extra?: Omit<UpdaterStatusPayload, 'status'>): void {
    status = next
    if (extra && 'version' in extra) version = extra.version
    if (extra && 'message' in extra) message = extra.message
    emit()
  }

  function mock(next: UpdaterStatus, extra?: Omit<UpdaterStatusPayload, 'status'>): void {
    setStatus(next, extra)
  }

  function check(): { status: UpdaterStatus; version?: string } {
    if (!opts.packaged) {
      setStatus('checking')
      setStatus('available', { version: FAKE_VERSION })
      return { status: 'available', version: FAKE_VERSION }
    }
    setStatus('checking')
    return { status, version }
  }

  function download(): void {
    if (!opts.packaged) {
      setStatus('downloading')
      setStatus('downloaded')
      return
    }
    setStatus('downloading')
  }

  function install(): 'quit' | 'noop' {
    if (!opts.packaged) return 'noop'
    return status === 'downloaded' ? 'quit' : 'noop'
  }

  function onStatus(cb: (event: UpdaterStatusPayload) => void): () => void {
    listeners.add(cb)
    return () => {
      listeners.delete(cb)
    }
  }

  return {
    get status() {
      return status
    },
    get version() {
      return version
    },
    get message() {
      return message
    },
    mock,
    check,
    download,
    install,
    setStatus,
    onStatus
  }
}

let currentMachine: UpdaterMachine | null = null
let packagedCheck: (() => void) | undefined

export function getUpdaterMachine(): UpdaterMachine {
  if (!currentMachine) {
    currentMachine = createUpdaterMachine({ packaged: false })
  }
  return currentMachine
}

export function setUpdaterMachine(machine: UpdaterMachine): void {
  currentMachine = machine
}

export function bindPackagedCheck(fn: (() => void) | undefined): void {
  packagedCheck = fn
}

export function checkUpdates(): void {
  if (packagedCheck) {
    packagedCheck()
    return
  }
  getUpdaterMachine().check()
}
