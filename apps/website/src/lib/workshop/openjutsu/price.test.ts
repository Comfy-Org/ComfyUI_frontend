import { describe, expect, it } from 'vitest'

import type { ReshootQuote } from '@/lib/workshop/cinematic-studio/reshoot-engine/transport'
import { perSecondNote, priceReadable, runQuote, swapPriceNote } from './price'
import { swapWorkflow } from './workflow'

const byResolution = (credits: Record<string, number>): ReshootQuote => ({
  free_runs_remaining: 0,
  price_credits: 0,
  price_per_second: { tier_input: 'resolution', tier_match: 'exact', credits },
  next_run: 'paid'
})
const catalog = byResolution({ '480': 8, '768': 16 })
const flat: ReshootQuote = {
  free_runs_remaining: 0,
  price_credits: 40,
  next_run: 'paid'
}

describe('runQuote', () => {
  it.for([
    { size: '480p', seconds: 5, credits: 40 },
    { size: '768p', seconds: 5, credits: 80 },
    { size: '480p', seconds: 9.4, credits: 76 },
    { size: '768p', seconds: 13.6, credits: 218 },
    { size: '768p', seconds: 15, credits: 240 }
  ] as const)(
    'prices a $seconds s part at $size at $credits credits, as the proxy charges it',
    ({ size, seconds, credits }) => {
      expect(runQuote(catalog, { seconds, size })).toMatchObject({
        price_credits: credits,
        price_per_second: undefined,
        next_run: 'paid'
      })
    }
  )

  it.for(['480p', '768p'] as const)(
    'prices the seconds and quality the graph sends PrepareVideo, at %s',
    (size) => {
      const graph = swapWorkflow({
        video: 'clip.mp4',
        character: 'hero.png',
        target: '',
        start: 0,
        seconds: 9.4,
        size,
        canvas: { width: 1344, height: 768 },
        result: { width: 1344, height: 756 },
        seed: 1
      })
      const sent = graph['31'].inputs
      const rate = catalog.price_per_second?.credits[String(sent.resolution)]

      expect(rate).toBeDefined()
      expect(runQuote(catalog, { seconds: 9.4, size })?.price_credits).toBe(
        Math.ceil(Number(sent.duration_seconds) * Number(rate) - 1e-9)
      )
    }
  )

  it.for<[string, ReshootQuote, Parameters<typeof runQuote>[1]]>([
    ['before a part is chosen', catalog, { size: '768p' }],
    ['before the quality is known', catalog, { seconds: 5 }],
    [
      'a quality the catalog has no rate for',
      byResolution({ '768': 16 }),
      { seconds: 5, size: '480p' }
    ],
    [
      'tiers matched by area',
      {
        ...catalog,
        price_per_second: {
          tier_input: 'resolution',
          tier_match: 'at_most',
          credits: { '768': 16 }
        }
      },
      { seconds: 5, size: '768p' }
    ],
    [
      'a tier on another input',
      {
        ...catalog,
        price_per_second: { tier_input: 'megapixels', credits: { '1.1': 16 } }
      },
      { seconds: 5, size: '768p' }
    ]
  ])('prices nothing with %s', ([, quote, run]) => {
    expect(runQuote(quote, run)).toBeUndefined()
  })

  it('leaves a flat price as it came', () => {
    expect(runQuote(flat, { seconds: 5 })).toBe(flat)
  })
})

describe('perSecondNote', () => {
  it('gives the rate of the chosen quality before a part is chosen', () => {
    expect(perSecondNote(catalog, '480p', 'en')).toBe('8 credits per second')
    expect(perSecondNote(catalog, '768p', 'en')).toBe('16 credits per second')
  })

  it('needs the quality while the rates differ, and not once they match', () => {
    expect(perSecondNote(catalog, undefined, 'en')).toBeUndefined()
    expect(
      perSecondNote(byResolution({ '480': 9, '768': 9 }), undefined, 'en')
    ).toBe('9 credits per second')
  })

  it('says nothing when the next run is free', () => {
    expect(
      perSecondNote({ ...catalog, next_run: 'free' }, '768p', 'en')
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
      { seconds: 5, size: '768p' },
      true
    ],
    ['the catalog price before a part', catalog, { size: '768p' }, false],
    [
      'a quality without a rate',
      byResolution({ '768': 16 }),
      { seconds: 5, size: '480p' },
      false
    ]
  ])('with %s: %s', ([, quote, run, readable]) => {
    expect(priceReadable(quote, run)).toBe(readable)
  })
})

describe('swapPriceNote', () => {
  const unreadable = byResolution({})

  it.for<[string, ReshootQuote, Parameters<typeof runQuote>[1], string]>([
    ['the rate before a part is chosen', catalog, {}, '16 credits per second'],
    ['the price of the part', catalog, { seconds: 5 }, '80 credits'],
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
      { seconds: 5 },
      'Price not available'
    ],
    ['the same before a part', unreadable, {}, 'Price not available']
  ])('shows %s', ([, quote, run, note]) => {
    expect(swapPriceNote(quote, { size: '768p', ...run }, 'en')).toBe(note)
  })
})
