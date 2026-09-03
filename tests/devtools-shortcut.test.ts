import { describe, expect, it } from 'vitest'
import { isDevtoolsShortcut } from '../src/main/windows/window-security'

function input(partial: {
  key: string
  control?: boolean
  alt?: boolean
  shift?: boolean
  meta?: boolean
}): {
  key: string
  control: boolean
  alt: boolean
  shift: boolean
  meta: boolean
} {
  return {
    control: false,
    alt: false,
    shift: false,
    meta: false,
    ...partial
  }
}

describe('isDevtoolsShortcut', () => {
  it('matches the packaged DevTools combinations', () => {
    expect(isDevtoolsShortcut(input({ key: 'i', meta: true, alt: true }))).toBe(true)
    expect(isDevtoolsShortcut(input({ key: 'I', control: true, alt: true }))).toBe(true)
    expect(isDevtoolsShortcut(input({ key: 'i', meta: true, shift: true }))).toBe(true)
    expect(isDevtoolsShortcut(input({ key: 'i', control: true, shift: true }))).toBe(true)
    expect(isDevtoolsShortcut(input({ key: 'F12' }))).toBe(true)
    expect(isDevtoolsShortcut(input({ key: 'j', meta: true, alt: true }))).toBe(true)
    expect(isDevtoolsShortcut(input({ key: 'J', control: true, shift: true }))).toBe(true)
  })

  it('does not match ordinary typing, copy, or reload', () => {
    expect(isDevtoolsShortcut(input({ key: 'a' }))).toBe(false)
    expect(isDevtoolsShortcut(input({ key: 'c', control: true }))).toBe(false)
    expect(isDevtoolsShortcut(input({ key: 'r', control: true }))).toBe(false)
    expect(isDevtoolsShortcut(input({ key: 'r', meta: true }))).toBe(false)
  })
})
