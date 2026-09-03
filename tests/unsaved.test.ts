import { describe, expect, it, vi } from 'vitest'
import {
  isDirtySnapshot,
  noteSnapshot,
  runUnsavedGuard,
  type UnsavedChoice
} from '../src/shared/unsaved'

describe('isDirtySnapshot', () => {
  it('is dirty when current differs from clean', () => {
    expect(isDirtySnapshot('a', 'b')).toBe(true)
    expect(isDirtySnapshot('a', 'a')).toBe(false)
    expect(isDirtySnapshot(null, 'a')).toBe(false)
  })
})

describe('noteSnapshot', () => {
  it('includes title body pin and encrypt', () => {
    const snap = noteSnapshot({
      id: 1,
      title: 't',
      body: 'b',
      pinned: true,
      isEncrypted: false,
      createdAt: 0,
      updatedAt: 0
    })
    expect(snap).toContain('"title":"t"')
    expect(
      isDirtySnapshot(
        noteSnapshot({
          id: 1,
          title: 't2',
          body: 'b',
          pinned: true,
          isEncrypted: false,
          createdAt: 0,
          updatedAt: 0
        }),
        snap
      )
    ).toBe(true)
  })
})

describe('runUnsavedGuard', () => {
  it('skips the prompt when clean', async () => {
    const ask = vi.fn<() => Promise<UnsavedChoice>>()
    await expect(runUnsavedGuard({ dirty: false, ask, save: async () => true })).resolves.toBe(true)
    expect(ask).not.toHaveBeenCalled()
  })

  it('cancels, saves, or discards', async () => {
    await expect(
      runUnsavedGuard({ dirty: true, ask: async () => 'cancel', save: async () => true })
    ).resolves.toBe(false)
    await expect(
      runUnsavedGuard({ dirty: true, ask: async () => 'save', save: async () => true })
    ).resolves.toBe(true)
    await expect(
      runUnsavedGuard({ dirty: true, ask: async () => 'save', save: async () => false })
    ).resolves.toBe(false)
    await expect(
      runUnsavedGuard({ dirty: true, ask: async () => 'discard', save: async () => true })
    ).resolves.toBe(true)
  })
})
