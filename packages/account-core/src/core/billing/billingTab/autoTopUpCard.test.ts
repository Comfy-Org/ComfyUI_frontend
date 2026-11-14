import type { AutoReloadSettings, AutoTopUpSetup } from '@comfyorg/ingest-types'
import { describe, expect, it } from 'vitest'

import {
  autoTopUpOffView,
  canSetUpAutoTopUp,
  deriveAutoTopUpCard,
  deriveAutoTopUpSection,
  isAutoTopUpNotAvailable
} from './autoTopUpCard'
import type {
  AutoTopUpSectionFacts,
  AutoTopUpSetupFacts
} from './autoTopUpCard'

const settings: AutoReloadSettings = {
  auto_top_up_conflict: false,
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
    canViewAutoTopUpMemberNotice: false
  }
  const member: AutoTopUpSectionFacts = {
    autoTopUpEnabled: true,
    canViewAutoTopUpCard: false,
    canViewAutoTopUpMemberNotice: true
  }

  it.for<{ case: string; facts: AutoTopUpSectionFacts; kind: string }>([
    { case: 'a granted card', facts: owner, kind: 'card' },
    {
      case: 'a withheld card',
      facts: { ...owner, canViewAutoTopUpCard: false },
      kind: 'hidden'
    },
    {
      case: 'a granted card beside a granted member notice',
      facts: { ...owner, canViewAutoTopUpMemberNotice: true },
      kind: 'card'
    },
    {
      case: 'a member on a healthy workspace',
      facts: member,
      kind: 'memberBlock'
    },
    {
      case: 'a member on a paused workspace',
      facts: { ...member, canViewAutoTopUpMemberNotice: false },
      kind: 'hidden'
    },
    {
      case: 'a member with the flag off',
      facts: { ...member, autoTopUpEnabled: false },
      kind: 'hidden'
    },
    {
      case: 'an owner with the flag off',
      facts: { ...owner, autoTopUpEnabled: false },
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

describe('canSetUpAutoTopUp', () => {
  const manager: AutoTopUpSetupFacts = {
    autoTopUpEnabled: true,
    canManageAutoTopUp: true,
    setup: { state: 'ready' }
  }

  it.for<{ name: string; facts: Partial<AutoTopUpSetupFacts>; can: boolean }>([
    { name: 'a manager with a ready setup', facts: {}, can: true },
    {
      name: 'a setup frozen for a missing default card',
      facts: {
        setup: { state: 'frozen', reason: 'default_payment_method_missing' }
      },
      can: true
    },
    {
      name: 'auto top-up not served',
      facts: { autoTopUpEnabled: false },
      can: false
    },
    {
      name: 'no can_manage_auto_top_up',
      facts: { canManageAutoTopUp: false },
      can: false
    },
    { name: 'no served setup', facts: { setup: null }, can: false },
    {
      name: 'an unavailable setup',
      facts: { setup: { state: 'unavailable' } },
      can: false
    },
    {
      name: 'a setup frozen for past due',
      facts: { setup: { state: 'frozen', reason: 'payment_past_due' } },
      can: false
    },
    {
      name: 'a setup frozen for paused billing',
      facts: { setup: { state: 'frozen', reason: 'billing_paused' } },
      can: false
    }
  ])('$name: $can', ({ facts, can }) => {
    expect(canSetUpAutoTopUp({ ...manager, ...facts })).toBe(can)
  })
})

describe('isAutoTopUpNotAvailable', () => {
  it.for<{ setup: AutoTopUpSetup | null; hidden: boolean }>([
    { setup: null, hidden: false },
    { setup: { state: 'ready' }, hidden: false },
    {
      setup: { state: 'frozen', reason: 'default_payment_method_missing' },
      hidden: false
    },
    {
      setup: { state: 'frozen', reason: 'billing_payment_pending' },
      hidden: false
    },
    { setup: { state: 'frozen', reason: 'billing_paused' }, hidden: true },
    { setup: { state: 'frozen', reason: 'payment_past_due' }, hidden: true },
    {
      setup: { state: 'unavailable', reason: 'billing_rail_not_supported' },
      hidden: true
    }
  ])('reads setup $setup as hidden: $hidden', ({ setup, hidden }) => {
    expect(isAutoTopUpNotAvailable(setup)).toBe(hidden)
  })
})
