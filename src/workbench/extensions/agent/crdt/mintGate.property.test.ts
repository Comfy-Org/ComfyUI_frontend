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

function key({
  flagEnabled,
  docBound,
  localProvenance,
  teardown
}: MintGateInput): string {
  return `flag=${flagEnabled} doc=${docBound} local=${localProvenance} teardown=${teardown}`
}

describe('shouldMint — exhaustive over the whole input domain', () => {
  it('matches the literal truth table', () => {
    const expected: Record<string, boolean> = Object.fromEntries(
      ALL_STATES.map((s) => [key(s), false])
    )
    // The single true state: flag enabled, doc bound, local provenance,
    // and NOT teardown — an ordinary tab switch, not the clear-storm case.
    expected[
      key({
        flagEnabled: true,
        docBound: true,
        localProvenance: true,
        teardown: false
      })
    ] = true

    const actual = Object.fromEntries(
      ALL_STATES.map((s) => [key(s), shouldMint(s)])
    )
    expect(actual).toEqual(expected)
  })
})
