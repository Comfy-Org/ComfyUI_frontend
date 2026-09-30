import { describe, expect, it } from 'vitest'

import type { Locale } from '../../../../i18n/site'
import type { ReshootRun } from './notes'
import { failureNote, quoteNote, runPrice } from './notes'
import type { ReshootQuote } from './transport'
import { ReshootError } from './transport'

const NOW = Date.parse('2026-09-25T12:00:00Z')
const DAY = 86_400

function quote(patch: Partial<ReshootQuote> = {}): ReshootQuote {
  return {
    free_runs_allowance: { runs: 5, period: 'P7D', period_seconds: 7 * DAY },
    free_runs_remaining: 3,
    resets_at: null,
    price_credits: 40,
    next_run: 'free',
    ...patch
  }
}

describe('quoteNote', () => {
  it.for<{ name: string; quote: ReshootQuote; locale?: Locale; note: string }>([
    {
      name: 'free, weekly',
      quote: quote(),
      note: 'Free · 3 of 5 left this week'
    },
    {
      name: 'free, daily',
      quote: quote({
        free_runs_allowance: { runs: 2, period: 'P1D', period_seconds: DAY },
        free_runs_remaining: 1
      }),
      note: 'Free · 1 of 2 left today'
    },
    {
      name: 'free, every 12 hours',
      quote: quote({
        free_runs_allowance: {
          runs: 1,
          period: 'PT12H',
          period_seconds: 12 * 3600
        },
        free_runs_remaining: 1
      }),
      note: 'Free · 1 of 1 left per 12 hours'
    },
    {
      name: 'free, weekly, Chinese',
      quote: quote(),
      locale: 'zh-CN',
      note: '免费 · 本周剩余 3/5 次'
    },
    {
      name: 'paid',
      quote: quote({ next_run: 'paid', free_runs_remaining: 0 }),
      note: '40 credits'
    },
    {
      name: 'short of credits',
      quote: quote({
        next_run: 'blocked',
        blocked_reason: 'insufficient_credits'
      }),
      note: '40 credits'
    },
    {
      name: 'out of free runs',
      quote: quote({
        next_run: 'blocked',
        blocked_reason: 'free_runs_exhausted',
        price_credits: 0,
        free_runs_remaining: 0,
        resets_at: new Date(NOW + 3 * DAY * 1000).toISOString()
      }),
      note: 'No free runs left; next one in 3 days'
    },
    {
      name: 'out of free runs, reset tomorrow',
      quote: quote({
        next_run: 'blocked',
        blocked_reason: 'free_runs_exhausted',
        price_credits: 0,
        resets_at: new Date(NOW + 5 * 3600 * 1000).toISOString()
      }),
      note: 'No free runs left; next one in 5 hours'
    },
    {
      name: 'a take already rendering',
      quote: quote({
        next_run: 'blocked',
        blocked_reason: 'concurrent_run_limit'
      }),
      note: 'One take at a time: wait for this one to finish.'
    }
  ])('$name', ({ quote: q, locale = 'en', note }) => {
    expect(quoteNote(q, locale, { size: '480p' }, NOW)).toBe(note)
  })
})

const PER_SECOND = quote({
  free_runs_allowance: undefined,
  free_runs_remaining: 0,
  price_credits: 0,
  next_run: 'paid',
  price_per_second: {
    tier_input: 'megapixels',
    credits: { '0.4': 18, '1': 45 }
  }
})

describe('per-second price', () => {
  it.for<{ name: string; run: ReshootRun; price?: number; note: string }>([
    {
      name: 'before the clip is read, the rate for its size',
      run: { size: '768p' },
      note: '45 credits per second'
    },
    {
      name: 'a read clip at 480p, rounded up',
      run: { size: '480p', seconds: 4.04 },
      price: 73,
      note: '73 credits'
    },
    {
      name: 'a whole number of seconds is not rounded up',
      run: { size: '480p', seconds: 5 },
      price: 90,
      note: '90 credits'
    },
    {
      name: 'a read clip at 768p',
      run: { size: '768p', seconds: 4.0625 },
      price: 183,
      note: '183 credits'
    }
  ])('$name', ({ run, price, note }) => {
    expect(runPrice(PER_SECOND, run)).toBe(price)
    expect(quoteNote(PER_SECOND, 'en', run, NOW)).toBe(note)
  })

  it('says the price is not available when the quote has no rate for the size', () => {
    const q = quote({
      ...PER_SECOND,
      price_per_second: { tier_input: 'megapixels', credits: { '0.4': 18 } }
    })
    expect(runPrice(q, { size: '768p', seconds: 4 })).toBeUndefined()
    expect(quoteNote(q, 'en', { size: '768p' }, NOW)).toBe(
      'Price not available'
    )
  })

  it('keeps a flat price whatever the clip', () => {
    expect(
      runPrice(quote({ next_run: 'paid' }), { size: '768p', seconds: 9 })
    ).toBe(40)
  })
})

describe('failureNote', () => {
  it.for<{ error: unknown; price?: number; note: string }>([
    {
      error: new ReshootError('free_runs_exhausted', 2 * DAY),
      note: 'No free runs left; next one in 2 days'
    },
    {
      error: new ReshootError('free_runs_exhausted', 600),
      price: 40,
      note: 'No free runs left; next one in 10 minutes · 40 credits'
    },
    {
      error: new ReshootError('upload_rate_limited', 1800),
      note: 'Too many tries for now. Try again in 30 minutes.'
    },
    {
      error: new ReshootError('app_unavailable'),
      note: 'Re-shoot is not available right now. Try again later.'
    },
    {
      error: new TypeError('Failed to fetch'),
      note: 'Something went wrong. Try again.'
    }
  ])('explains $error.code', ({ error, price, note }) => {
    expect(failureNote(error, 'en', price)).toBe(note)
  })
})
