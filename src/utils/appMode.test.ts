import { describe, expect, it } from 'vitest'

import { getWorkflowMode, isAppModeValue } from '@/utils/appMode'

describe('getWorkflowMode', () => {
  it('prefers active mode over initial mode', () => {
    expect(
      getWorkflowMode({
        activeMode: 'builder:arrange',
        initialMode: 'app'
      })
    ).toBe('builder:arrange')
  })

  it('falls back to initial mode', () => {
    expect(
      getWorkflowMode({
        activeMode: null,
        initialMode: 'builder:inputs'
      })
    ).toBe('builder:inputs')
  })

  it('defaults to graph mode', () => {
    expect(getWorkflowMode(null)).toBe('graph')
    expect(
      getWorkflowMode({
        activeMode: null,
        initialMode: undefined
      })
    ).toBe('graph')
  })
})

describe('isAppModeValue', () => {
  it('recognizes app-style modes', () => {
    expect(isAppModeValue('app')).toBe(true)
    expect(isAppModeValue('builder:arrange')).toBe(true)
  })

  it('rejects graph and builder panel modes', () => {
    expect(isAppModeValue('graph')).toBe(false)
    expect(isAppModeValue('builder:inputs')).toBe(false)
    expect(isAppModeValue('builder:outputs')).toBe(false)
  })
})
