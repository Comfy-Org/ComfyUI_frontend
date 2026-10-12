import { describe, expect, it } from 'vitest'

import type { ReshootQuote } from '@/lib/workshop/cinematic-studio/reshoot-engine/transport'
import { runQuote } from './price'

const perFrame: ReshootQuote = {
  free_runs_remaining: 0,
  price_credits: 0,
  price_per_second: { tier_input: 'seed', credits: { '0': 1.0416666666 } },
  next_run: 'paid'
}
const flat: ReshootQuote = {
  free_runs_remaining: 0,
  price_credits: 40,
  next_run: 'paid'
}

describe('runQuote', () => {
  it.for([
    { seconds: 5, credits: 125 },
    { seconds: 7.3, credits: 183 },
    { seconds: 14.375, credits: 360 },
    { seconds: 15, credits: 360 }
  ])(
    'prices a $seconds s part at $credits credits, as the proxy charges it',
    ({ seconds, credits }) => {
      expect(runQuote(perFrame, seconds)).toMatchObject({
        price_credits: credits,
        price_per_second: undefined,
        next_run: 'paid'
      })
    }
  )

  it('leaves the quote alone until a part is chosen', () => {
    expect(runQuote(perFrame, undefined)).toBe(perFrame)
  })

  it('leaves a flat price as it came', () => {
    expect(runQuote(flat, 5)).toBe(flat)
  })
})
