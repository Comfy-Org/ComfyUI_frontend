import { describe, expect, it } from 'vitest'

import type { ReshootQuote } from '@/lib/workshop/cinematic-studio/reshoot-engine/transport'
import { gridFrames } from './clip'
import { perSecondNote, priceReadable, runQuote, swapPriceNote } from './price'
import { swapWorkflow } from './workflow'

const RATE = 1.0416666666
const canvas768 = { width: 1344, height: 768 }
const canvas480 = { width: 864, height: 480 }
const tooLarge = { width: 4096, height: 2304 }

const byArea = (credits: Record<string, number>): ReshootQuote => ({
  free_runs_remaining: 0,
  price_credits: 0,
  price_per_second: {
    tier_input: 'megapixels',
    tier_match: 'at_most',
    credits
  },
  next_run: 'paid'
})
const catalog = byArea({ '0.45': RATE, '1.1': RATE })
const flat: ReshootQuote = {
  free_runs_remaining: 0,
  price_credits: 40,
  next_run: 'paid'
}

describe('runQuote', () => {
  it.for([
    { seconds: 5, credits: 130 },
    { seconds: 6, credits: 165 },
    { seconds: 7.3, credits: 183 },
    { seconds: 14.375, credits: 360 },
    { seconds: 15, credits: 360 }
  ])(
    'prices a $seconds s part at $credits credits, as the proxy charges it',
    ({ seconds, credits }) => {
      expect(runQuote(catalog, { seconds, canvas: canvas768 })).toMatchObject({
        price_credits: credits,
        price_per_second: undefined,
        next_run: 'paid'
      })
    }
  )

  it.for([5, 6, 10, 14.375])(
    'prices the frames the graph asks the model node to generate, at %s s',
    (seconds) => {
      const graph = swapWorkflow({
        video: 'clip.mp4',
        character: 'hero.png',
        target: 'the man',
        start: 0,
        seconds,
        canvas: canvas768,
        result: canvas768,
        seed: 1
      })
      const billed = graph['136'].inputs.length

      expect(billed).toBe(gridFrames(seconds))
      expect(
        runQuote(catalog, { seconds, canvas: canvas768 })?.price_credits
      ).toBe(Math.ceil(Number(billed) * RATE - 1e-9))
    }
  )

  it('takes the rate of the smallest area tier the canvas fits in', () => {
    const tiers = byArea({ '0.45': 0.5, '1.1': RATE })

    expect(
      runQuote(tiers, { seconds: 5, canvas: canvas480 })?.price_credits
    ).toBe(62)
    expect(
      runQuote(tiers, { seconds: 5, canvas: canvas768 })?.price_credits
    ).toBe(130)
  })

  it.for<[string, ReshootQuote, Parameters<typeof runQuote>[1]]>([
    ['before a part is chosen', catalog, { canvas: canvas768 }],
    ['before the canvas is known', catalog, { seconds: 5 }],
    [
      'a canvas larger than every tier',
      catalog,
      { seconds: 5, canvas: tooLarge }
    ],
    [
      'tiers matched exactly',
      {
        ...catalog,
        price_per_second: {
          tier_input: 'megapixels',
          tier_match: 'exact',
          credits: { '1.1': RATE }
        }
      },
      { seconds: 5, canvas: canvas768 }
    ],
    [
      'a tier on another input',
      {
        ...catalog,
        price_per_second: { tier_input: 'seed', credits: { '0': RATE } }
      },
      { seconds: 5, canvas: canvas768 }
    ]
  ])('prices nothing with %s', ([, quote, run]) => {
    expect(runQuote(quote, run)).toBeUndefined()
  })

  it('leaves a flat price as it came', () => {
    expect(runQuote(flat, { seconds: 5 })).toBe(flat)
  })
})

describe('perSecondNote', () => {
  it('gives the rate per second of result before a part is chosen', () => {
    expect(perSecondNote(catalog, undefined, 'en')).toBe(
      '25 credits per second'
    )
  })

  it('needs the canvas once the tiers differ', () => {
    const tiers = byArea({ '0.45': 0.5, '1.1': RATE })

    expect(perSecondNote(tiers, undefined, 'en')).toBeUndefined()
    expect(perSecondNote(tiers, canvas480, 'en')).toBe('12 credits per second')
  })

  it('says nothing when the next run is free', () => {
    expect(
      perSecondNote({ ...catalog, next_run: 'free' }, undefined, 'en')
    ).toBeUndefined()
  })
})

describe('priceReadable', () => {
  it.for<
    [
      string,
      ReshootQuote | undefined,
      Parameters<typeof priceReadable>[1],
      boolean
    ]
  >([
    ['no quote', undefined, { seconds: 5 }, true],
    ['a flat price', flat, { seconds: 5 }, true],
    [
      'the catalog price and a part',
      catalog,
      { seconds: 5, canvas: canvas768 },
      true
    ],
    ['the catalog price before a part', catalog, { canvas: canvas768 }, false],
    ['a canvas too large', catalog, { seconds: 5, canvas: tooLarge }, false]
  ])('with %s: %s', ([, quote, run, readable]) => {
    expect(priceReadable(quote, run)).toBe(readable)
  })
})

describe('swapPriceNote', () => {
  const unreadable = byArea({})

  it.for<[string, ReshootQuote, Parameters<typeof runQuote>[1], string]>([
    ['the rate before a part is chosen', catalog, {}, '25 credits per second'],
    [
      'the price of the part',
      catalog,
      { seconds: 5, canvas: canvas768 },
      '130 credits'
    ],
    ['a flat price as it is', flat, {}, '40 credits'],
    [
      'free runs as free',
      { ...catalog, next_run: 'free' },
      { seconds: 5 },
      'Free'
    ],
    [
      'that a price it cannot read is unknown',
      unreadable,
      { seconds: 5, canvas: canvas768 },
      'Price not available'
    ],
    ['the same before a part', unreadable, {}, 'Price not available']
  ])('shows %s', ([, quote, run, note]) => {
    expect(swapPriceNote(quote, { size: '768p', ...run }, 'en')).toBe(note)
  })
})
