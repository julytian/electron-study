import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ELECTRON_FUSES } from '../src/shared/electron-fuses'

describe('ELECTRON_FUSES', () => {
  it('matches the electron-builder.yml electronFuses block', () => {
    const yml = readFileSync(resolve(__dirname, '../electron-builder.yml'), 'utf8')
    const block = yml.match(/electronFuses:\n((?:  .+\n)+)/)?.[1] ?? ''
    expect(block).toBeTruthy()
    const keys = Object.keys(ELECTRON_FUSES)
    expect(keys).toHaveLength(8)
    for (const [key, value] of Object.entries(ELECTRON_FUSES)) {
      expect(block).toContain(`${key}: ${value}`)
    }
  })
})
