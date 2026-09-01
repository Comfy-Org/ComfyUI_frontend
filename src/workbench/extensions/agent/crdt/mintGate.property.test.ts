/**
 * Exhaustive coverage of the mint gate.
 *
 * `mintGate.test.ts` walks the five one-conjunct-off cases. The gate has four
 * booleans, so those five leave 11 of the 16 states unvisited — and the states
 * that actually matter are the combinations: teardown coinciding with a bound
 * doc and local provenance is an ordinary tab switch, and that is precisely the
 * clear-storm the gate exists to stop. A regression that dropped the teardown
 * conjunct from the conjunction, or that ORed two of them, still passes every
 * example test.
 *
 * The domain is 16 states, so this enumerates all of them rather than sampling.
 */
import { describe, expect, it } from 'vitest'

import type { MintGateInput } from './mintGate'
import { shouldMint } from './mintGate'

const BOOLS = [false, true] as const

const ALL_STATES: MintGateInput[] = BOOLS.flatMap((flagEnabled) =>
  BOOLS.flatMap((docBound) =>
    BOOLS.flatMap((localProvenance) =>
      BOOLS.map((teardown) => ({
        flagEnabled,
        docBound,
        localProvenance,
        teardown
      }))
    )
  )
)

describe('shouldMint — exhaustive over the whole input domain', () => {
  it('enumerates all 16 states', () => {
    expect(ALL_STATES).toHaveLength(16)
    expect(new Set(ALL_STATES.map((s) => JSON.stringify(s))).size).toBe(16)
  })

  it('matches the literal truth table', () => {
    const expected = [
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      true,
      false
    ]
    expect(ALL_STATES.map(shouldMint)).toEqual(expected)
  })
})
