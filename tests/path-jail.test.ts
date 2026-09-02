import { describe, expect, it } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assertWithinRoot } from '../src/main/services/path-jail'

describe('assertWithinRoot', () => {
  const root = mkdtempSync(join(tmpdir(), 'elab-'))

  it('allows files inside root', () => {
    expect(assertWithinRoot(join(root, 'a.txt'), root)).toBe(join(root, 'a.txt'))
  })

  it('rejects parent escape', () => {
    expect(() => assertWithinRoot(join(root, '..', 'secret'), root)).toThrowError(/E_PATH/)
  })
})
