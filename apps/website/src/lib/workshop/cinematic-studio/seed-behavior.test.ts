import { describe, expect, it } from 'vitest'
import { nextSeed } from './seed-behavior'

describe('seed behavior', () => {
  it.for([
    [0, 'fixed', 0],
    [0, 'increment', 1],
    [9, 'increment', 0],
    [9, 'decrement', 8],
    [0, 'decrement', 9]
  ] as const)('advances %s with %s to %s', ([value, behavior, expected]) => {
    expect(nextSeed(value, behavior, { minimum: 0, maximum: 9, step: 1 })).toBe(
      expected
    )
  })
  it('never exceeds safe integers when a model has no maximum', () => {
    expect(nextSeed(Number.MAX_SAFE_INTEGER, 'increment', { step: 1 })).toBe(0)
  })
})
