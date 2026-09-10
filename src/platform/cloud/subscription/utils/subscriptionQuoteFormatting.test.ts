import type { PreviewSubscribeResponse } from '@comfyorg/ingest-types'
import { describe, expect, it } from 'vitest'

import {
  formatAmountDueToday,
  formatRenewalAmount,
  resolveRenewalDate
} from './subscriptionQuoteFormatting'

function legacyPreview(
  overrides: Partial<PreviewSubscribeResponse> = {}
): PreviewSubscribeResponse {
  return {
    allowed: true,
    transition_type: 'new_subscription',
    effective_at: '2026-06-19T00:00:00Z',
    is_immediate: true,
    cost_today_cents: 2000,
    cost_next_period_cents: 3000,
    credits_today_cents: 0,
    credits_next_period_cents: 0,
    new_plan: {
      slug: 'creator',
      tier: 'CREATOR',
      duration: 'MONTHLY',
      price_cents: 2000,
      credits_cents: 0,
      seat_summary: {
        seat_count: 1,
        total_cost_cents: 2000,
        total_credits_cents: 0
      }
    },
    ...overrides
  }
}

function exactPreview(
  overrides: Partial<PreviewSubscribeResponse> = {}
): PreviewSubscribeResponse {
  return legacyPreview({
    amount_due_cents: 1500,
    currency: 'usd',
    renewal_amount_cents: 2500,
    renewal_at: '2026-07-19T00:00:00Z',
    ...overrides
  })
}

describe('formatAmountDueToday', () => {
  it('prices the exact quote when the server sent one', () => {
    expect(formatAmountDueToday(exactPreview(), 'en')).toBe('$15.00')
  })

  it('falls back to the legacy cost when the exact quote is absent', () => {
    expect(formatAmountDueToday(legacyPreview(), 'en')).toBe('$20.00')
  })

  it('honours a non-USD exact quote', () => {
    const preview = exactPreview({ currency: 'eur' })
    expect(formatAmountDueToday(preview, 'en')).toBe('€15.00')
  })
})

describe('formatRenewalAmount', () => {
  it('prices the exact renewal when the server sent one', () => {
    expect(formatRenewalAmount(exactPreview(), 'en')).toBe('$25.00')
  })

  it('falls back to the legacy next-period cost', () => {
    expect(formatRenewalAmount(legacyPreview(), 'en')).toBe('$30.00')
  })
})

describe('resolveRenewalDate', () => {
  it('prefers the exact renewal instant', () => {
    expect(resolveRenewalDate(exactPreview())).toBe('2026-07-19T00:00:00Z')
  })

  it('falls back to the target plan period end', () => {
    const preview = legacyPreview()
    const withPeriodEnd = {
      ...preview,
      new_plan: { ...preview.new_plan, period_end: '2026-08-19T00:00:00Z' }
    }
    expect(resolveRenewalDate(withPeriodEnd)).toBe('2026-08-19T00:00:00Z')
  })

  it('reports no date when the server supplied none', () => {
    expect(resolveRenewalDate(legacyPreview())).toBeUndefined()
  })
})
