import { describe, expect, it } from 'vitest'

import type { ReshootQuote } from '@/lib/workshop/cinematic-studio/reshoot-engine/transport'
import { perSecondNote, priceReadable, runQuote, swapPriceNote } from './price'

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

  it('prices nothing until a part is chosen', () => {
    expect(runQuote(perFrame, undefined)).toBeUndefined()
  })

  it('prices nothing it cannot read the way the proxy charges', () => {
    const tiered: ReshootQuote = {
      ...perFrame,
      price_per_second: {
        tier_input: 'megapixels',
        credits: { '0': 1.0416666666, '1': 45 }
      }
    }

    expect(runQuote(tiered, 5)).toBeUndefined()
    expect(perSecondNote(tiered, 'en')).toBeUndefined()
  })

  it('leaves a flat price as it came', () => {
    expect(runQuote(flat, 5)).toBe(flat)
  })
})

describe('perSecondNote', () => {
  it('gives the rate per second of result before a part is chosen', () => {
    expect(perSecondNote(perFrame, 'en')).toBe('25 credits per second')
  })

  it('says nothing when the next run is free', () => {
    expect(
      perSecondNote({ ...perFrame, next_run: 'free' }, 'en')
    ).toBeUndefined()
  })
})

describe('priceReadable', () => {
  it.for<[string, ReshootQuote | undefined, number | undefined, boolean]>([
    ['no quote', undefined, 5, true],
    ['a flat price', flat, 5, true],
    ['a per-frame price and a part', perFrame, 5, true],
    ['a per-frame price before a part', perFrame, undefined, false],
    [
      'a tiered price',
      {
        ...perFrame,
        price_per_second: { tier_input: 'megapixels', credits: { '1': 45 } }
      },
      5,
      false
    ]
  ])('with %s: %s', ([, quote, seconds, readable]) => {
    expect(priceReadable(quote, seconds)).toBe(readable)
  })
})

describe('swapPriceNote', () => {
  const tiered: ReshootQuote = {
    ...perFrame,
    price_per_second: { tier_input: 'megapixels', credits: { '1': 45 } }
  }

  it.for<[string, ReshootQuote, number | undefined, string]>([
    [
      'the rate before a part is chosen',
      perFrame,
      undefined,
      '25 credits per second'
    ],
    ['the price of the part', perFrame, 5, '125 credits'],
    ['a flat price as it is', flat, undefined, '40 credits'],
    ['free runs as free', { ...perFrame, next_run: 'free' }, 5, 'Free'],
    [
      'that a price it cannot read is unknown',
      tiered,
      5,
      'Price not available'
    ],
    ['the same before a part', tiered, undefined, 'Price not available']
  ])('shows %s', ([, quote, seconds, note]) => {
    expect(swapPriceNote(quote, { size: '768p', seconds }, 'en')).toBe(note)
  })
})
