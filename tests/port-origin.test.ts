import { describe, expect, it } from 'vitest'
import {
  isTrustedPortMessageOrigin,
  portMessageTargetOrigin
} from '../src/shared/port-origin'

describe('portMessageTargetOrigin', () => {
  it('returns the trimmed page origin', () => {
    expect(portMessageTargetOrigin('http://localhost:5173')).toBe('http://localhost:5173')
    expect(portMessageTargetOrigin('  file://  ')).toBe('file://')
  })

  it('never returns *', () => {
    const cases = ['*', '', '   ', 'http://localhost:5173', 'file://']
    for (const locationOrigin of cases) {
      expect(portMessageTargetOrigin(locationOrigin)).not.toBe('*')
    }
  })

  it('maps empty or star location origins to null', () => {
    expect(portMessageTargetOrigin('*')).toBe('null')
    expect(portMessageTargetOrigin('')).toBe('null')
    expect(portMessageTargetOrigin('   ')).toBe('null')
  })
})

describe('isTrustedPortMessageOrigin', () => {
  const locationOrigin = 'http://localhost:5173'

  it('accepts messages from the same origin', () => {
    expect(isTrustedPortMessageOrigin(locationOrigin, locationOrigin)).toBe(true)
    expect(isTrustedPortMessageOrigin(locationOrigin, `  ${locationOrigin}  `)).toBe(true)
  })

  it('rejects star origins', () => {
    expect(isTrustedPortMessageOrigin('*', locationOrigin)).toBe(false)
    expect(isTrustedPortMessageOrigin(locationOrigin, '*')).toBe(false)
  })

  it('rejects mismatched origins', () => {
    expect(isTrustedPortMessageOrigin('http://evil.test', locationOrigin)).toBe(false)
    expect(isTrustedPortMessageOrigin('http://localhost:9999', locationOrigin)).toBe(false)
  })
})
