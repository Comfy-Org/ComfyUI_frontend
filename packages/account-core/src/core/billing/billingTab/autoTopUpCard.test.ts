import type { AutoReloadSettings } from '@comfyorg/ingest-types'
import { describe, expect, it } from 'vitest'

import { deriveAutoTopUpCard } from './autoTopUpCard'

const settings: AutoReloadSettings = {
  card_expiry: null,
  configured: true,
  cycle_resets_at: null,
  declined_payment_method: null,
  disabled_reason: null,
  enabled: true,
  last_failure_at: null,
  last_failure_reason: null,
  max_monthly_budget_cents: 50_000,
  max_reload_credits: null,
  min_reload_credits: 0,
  monthly_budget_cents: null,
  monthly_budget_is_default: true,
  paused_by_budget: false,
  paused_by_budget_remainder: false,
  paused_by_decline: false,
  reload_amount_cents: 1_000,
  reload_credits: null,
  spent_this_cycle_cents: 0,
  status: 'on',
  target_credits: null,
  threshold_credits: null
}

describe('deriveAutoTopUpCard', () => {
  it.for([
    { isLoading: true, settings: null, kind: 'loading' },
    { isLoading: false, settings: null, kind: 'unavailable' },
    { isLoading: false, settings, kind: 'loaded' },
    { isLoading: true, settings, kind: 'loaded' }
  ] as const)(
    'loading=$isLoading with settings=$settings is $kind',
    ({ isLoading, settings, kind }) => {
      expect(deriveAutoTopUpCard({ isLoading, settings }).kind).toBe(kind)
    }
  )

  it('carries the served settings when loaded', () => {
    expect(deriveAutoTopUpCard({ isLoading: false, settings })).toEqual({
      kind: 'loaded',
      settings
    })
  })
})
