import { describe, expect, it } from 'vitest'

import { shouldMint } from './mintGate'

const OPEN = {
  flagEnabled: true,
  docBound: true,
  teardown: false
}

describe('shouldMint', () => {
  it('mints only when every conjunct holds', () => {
    expect(shouldMint(OPEN)).toBe(true)
  })

  it('never mints with the product flag off', () => {
    expect(shouldMint({ ...OPEN, flagEnabled: false })).toBe(false)
  })

  it('never mints without a bound doc', () => {
    expect(shouldMint({ ...OPEN, docBound: false })).toBe(false)
  })

  it('never mints for graph teardown (workflow load/switch/close clearing)', () => {
    expect(shouldMint({ ...OPEN, teardown: true })).toBe(false)
  })
})
