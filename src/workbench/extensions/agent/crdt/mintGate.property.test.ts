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

  it('is exactly flag ∧ bound ∧ local ∧ ¬teardown in every state', () => {
    for (const state of ALL_STATES) {
      const expected =
        state.flagEnabled &&
        state.docBound &&
        state.localProvenance &&
        !state.teardown
      expect({ state, mints: shouldMint(state) }).toEqual({
        state,
        mints: expected
      })
    }
  })

  it('opens in exactly one of the 16 states', () => {
    const open = ALL_STATES.filter(shouldMint)
    expect(open).toEqual([
      {
        flagEnabled: true,
        docBound: true,
        localProvenance: true,
        teardown: false
      }
    ])
  })

  it('never mints during teardown, whatever the other three conjuncts say', () => {
    const teardownStates = ALL_STATES.filter((state) => state.teardown)
    expect(teardownStates).toHaveLength(8)
    for (const state of teardownStates) expect(shouldMint(state)).toBe(false)
  })

  it('is monotone: closing any conjunct can never open a gate that was shut', () => {
    for (const state of ALL_STATES) {
      if (shouldMint(state)) continue
      // Every one-step "worsening" of an already-shut gate stays shut.
      const worsened: MintGateInput[] = [
        { ...state, flagEnabled: false },
        { ...state, docBound: false },
        { ...state, localProvenance: false },
        { ...state, teardown: true }
      ]
      for (const next of worsened) expect(shouldMint(next)).toBe(false)
    }
  })
})
