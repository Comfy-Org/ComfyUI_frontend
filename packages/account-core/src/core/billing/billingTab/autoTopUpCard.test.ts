import type { AutoReloadSettings } from '@comfyorg/ingest-types'
import { describe, expect, it } from 'vitest'

import {
  autoTopUpOffView,
  deriveAutoTopUpCard,
  deriveAutoTopUpSection
} from './autoTopUpCard'
import type { AutoTopUpSectionFacts } from './autoTopUpCard'

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

describe('deriveAutoTopUpSection', () => {
  const owner: AutoTopUpSectionFacts = {
    autoTopUpEnabled: true,
    canViewAutoTopUpCard: true,
    manageAutoTopUpDenial: undefined
  }
  const member: AutoTopUpSectionFacts = {
    autoTopUpEnabled: true,
    canViewAutoTopUpCard: false,
    manageAutoTopUpDenial: 'not_workspace_owner'
  }

  it.for<{ case: string; facts: AutoTopUpSectionFacts; kind: string }>([
    { case: 'a granted card', facts: owner, kind: 'card' },
    {
      case: 'a withheld card with no denial',
      facts: { ...owner, canViewAutoTopUpCard: false },
      kind: 'hidden'
    },
    {
      case: 'a granted card beside a stale denial',
      facts: { ...owner, manageAutoTopUpDenial: 'not_workspace_owner' },
      kind: 'card'
    },
    { case: 'a member', facts: member, kind: 'memberBlock' },
    {
      case: 'a member with the flag off',
      facts: { ...member, autoTopUpEnabled: false },
      kind: 'hidden'
    },
    {
      case: 'a not_a_member denial',
      facts: { ...member, manageAutoTopUpDenial: 'not_a_member' },
      kind: 'hidden'
    },
    {
      case: 'no served denial',
      facts: { ...member, manageAutoTopUpDenial: undefined },
      kind: 'hidden'
    }
  ])('shows $kind for $case', ({ facts, kind }) => {
    expect(deriveAutoTopUpSection(facts).kind).toBe(kind)
  })
})

describe('autoTopUpOffView', () => {
  const missingDefault = {
    state: 'frozen',
    reason: 'default_payment_method_missing'
  } as const

  it.for([
    { setup: null, count: null, view: 'off' },
    { setup: { state: 'ready' }, count: 0, view: 'off' },
    {
      setup: { state: 'frozen', reason: 'billing_paused' },
      count: 0,
      view: 'off'
    },
    { setup: missingDefault, count: 0, view: 'noPaymentMethod' },
    { setup: missingDefault, count: 2, view: 'noDefaultPaymentMethod' },
    { setup: missingDefault, count: null, view: 'noDefaultPaymentMethod' }
  ] as const)(
    'reads setup $setup with $count saved methods as $view',
    ({ setup, count, view }) => {
      expect(autoTopUpOffView({ setup, savedPaymentMethodCount: count })).toBe(
        view
      )
    }
  )
})
