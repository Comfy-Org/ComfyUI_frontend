import { describe, expect, it } from 'vitest'

import { shouldUseVueNodeLowDetail } from './useVueNodeLOD'

describe('shouldUseVueNodeLowDetail', () => {
  it('uses low detail strictly below the percentage threshold', () => {
    expect(shouldUseVueNodeLowDetail(0.949, true, 95, true)).toBe(true)
    expect(shouldUseVueNodeLowDetail(0.95, true, 95, true)).toBe(false)
  })

  it('requires both settings to be enabled', () => {
    expect(shouldUseVueNodeLowDetail(0.5, false, 95, true)).toBe(false)
    expect(shouldUseVueNodeLowDetail(0.5, true, 95, false)).toBe(false)
  })

  it('clamps the supported threshold range', () => {
    expect(shouldUseVueNodeLowDetail(0.09, true, 0, true)).toBe(true)
    expect(shouldUseVueNodeLowDetail(0.1, true, 0, true)).toBe(false)
    expect(shouldUseVueNodeLowDetail(0.99, true, 200, true)).toBe(true)
    expect(shouldUseVueNodeLowDetail(1, true, 200, true)).toBe(false)
  })
})
