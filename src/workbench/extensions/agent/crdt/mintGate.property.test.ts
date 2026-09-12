/**
 * Exhaustive coverage of the mint gate.
 *
 * `mintGate.test.ts` walks the one-conjunct-off cases. Exhaustively covering
 * all eight states also pins combinations such as teardown coinciding with a
 * bound doc, the clear-storm case the gate exists to stop.
 *
 * The domain is small, so this enumerates all of it rather than sampling.
 */
import { describe, expect, it } from 'vitest'

import type { MintGateInput } from './mintGate'
import { shouldMint } from './mintGate'

const BOOLS = [false, true] as const

const ALL_STATES: MintGateInput[] = BOOLS.flatMap((flagEnabled) =>
  BOOLS.flatMap((docBound) =>
    BOOLS.map((teardown) => ({ flagEnabled, docBound, teardown }))
  )
)

function key({ flagEnabled, docBound, teardown }: MintGateInput): string {
  return `flag=${flagEnabled} doc=${docBound} teardown=${teardown}`
}

describe('shouldMint — exhaustive over the whole input domain', () => {
  it('matches the literal truth table', () => {
    const expected: Record<string, boolean> = Object.fromEntries(
      ALL_STATES.map((s) => [key(s), false])
    )
    expected[
      key({
        flagEnabled: true,
        docBound: true,
        teardown: false
      })
    ] = true

    const actual = Object.fromEntries(
      ALL_STATES.map((s) => [key(s), shouldMint(s)])
    )
    expect(actual).toEqual(expected)
  })
})
