import type { AutoReloadSettings } from '@comfyorg/ingest-types'
import { describe, expect, it } from 'vitest'

import type {
  AddCreditsAutoTopUpFacts,
  AutoTopUpFormInput,
  AutoTopUpRules
} from './addCreditsAutoTopUp'
import {
  addCreditsAutoTopUpOffer,
  autoTopUpActivationFor,
  eachTopUpAtLeastCents,
  parseAutoTopUpForm,
  smallestTopUpCents,
  startAutoTopUpForm,
  validateAutoTopUp
} from './addCreditsAutoTopUp'

const RULES: AutoTopUpRules = {
  minReloadCredits: 1055,
  maxReloadCredits: 12_660_000,
  maxMonthlyBudgetCents: 6_000_000
}

const FORM: AutoTopUpFormInput = {
  threshold: '1,000',
  target: '11,550',
  limit: '10000',
  limitOn: false
}

const form = (overrides: Partial<AutoTopUpFormInput>) =>
  parseAutoTopUpForm({ ...FORM, ...overrides })

describe('startAutoTopUpForm', () => {
  it('opens at the starting threshold and tops up by the credits picked', () => {
    expect(startAutoTopUpForm(10_550)).toEqual({
      threshold: '1000',
      target: '11550',
      limit: '10000',
      limitOn: false
    })
  })
})

describe('validateAutoTopUp', () => {
  it.for<{
    name: string
    input: Partial<AutoTopUpFormInput>
    errors: ReturnType<typeof validateAutoTopUp>
  }>([
    { name: 'the prefilled fields', input: {}, errors: {} },
    {
      name: 'a fractional threshold',
      input: { threshold: '10.5' },
      errors: { threshold: 'notWhole' }
    },
    {
      name: 'a zero threshold',
      input: { threshold: '0' },
      errors: { threshold: 'belowMinimum' }
    },
    {
      name: 'a target under the served minimum top-up',
      input: { target: '2054' },
      errors: { target: 'belowTarget' }
    },
    {
      name: 'a target at the served minimum top-up',
      input: { target: '2055' },
      errors: {}
    },
    {
      name: 'a target over the auto top-up maximum',
      input: { target: '12661001' },
      errors: { target: 'aboveTarget' }
    },
    {
      name: 'a limit above the served ceiling',
      input: { limitOn: true, limit: '60000.01' },
      errors: { limit: 'aboveCeiling' }
    },
    {
      name: 'a limit that cannot cover one top-up',
      input: { limitOn: true, limit: '50' },
      errors: { limit: 'belowTopUp' }
    },
    {
      name: 'an unreadable limit',
      input: { limitOn: true, limit: 'ten' },
      errors: { limit: 'invalid' }
    },
    {
      name: 'an unreadable limit while the limit is off',
      input: { limitOn: false, limit: 'ten' },
      errors: {}
    }
  ])('$name', ({ input, errors }) => {
    expect(validateAutoTopUp(form(input), RULES)).toEqual(errors)
  })
})

describe('smallestTopUpCents', () => {
  it('prices one credit below the threshold up to the target, rounded up', () => {
    expect(smallestTopUpCents(form({}), RULES.maxReloadCredits)).toBe(5001)
  })
})

describe('eachTopUpAtLeastCents', () => {
  it('rounds target minus threshold down to the cent', () => {
    expect(eachTopUpAtLeastCents(form({}))).toBe(5000)
  })
})

describe('autoTopUpActivationFor', () => {
  it('sends no limit while the limit is off', () => {
    expect(autoTopUpActivationFor(form({}), RULES)).toEqual({
      threshold_credits: 1000,
      target_credits: 11550,
      monthly_budget_cents: null
    })
  })

  it('sends the limit entered once it is on', () => {
    expect(
      autoTopUpActivationFor(form({ limitOn: true }), RULES)
    ).toMatchObject({ monthly_budget_cents: 1_000_000 })
  })

  it('sends nothing while a field is in error', () => {
    expect(autoTopUpActivationFor(form({ target: '1' }), RULES)).toBeNull()
  })
})

const settings = (
  status: AutoReloadSettings['status']
): AutoReloadSettings => ({
  card_expiry: null,
  configured: false,
  cycle_resets_at: null,
  declined_payment_method: null,
  disabled_reason: null,
  enabled: status === 'on',
  last_failure_at: null,
  last_failure_reason: null,
  max_monthly_budget_cents: RULES.maxMonthlyBudgetCents,
  max_reload_credits: RULES.maxReloadCredits,
  min_reload_credits: RULES.minReloadCredits,
  monthly_budget_cents: null,
  monthly_budget_is_default: true,
  paused_by_budget: false,
  paused_by_budget_remainder: false,
  paused_by_decline: false,
  reload_amount_cents: null,
  reload_credits: null,
  spent_this_cycle_cents: 0,
  status,
  target_credits: null,
  threshold_credits: null
})

const OWNER: AddCreditsAutoTopUpFacts = {
  autoTopUpEnabled: true,
  canManageAutoTopUp: true,
  setup: { state: 'ready' },
  settings: settings('off'),
  defaultCard: null
}

describe('addCreditsAutoTopUpOffer', () => {
  it.for<{
    name: string
    facts: Partial<AddCreditsAutoTopUpFacts>
    kind: string
  }>([
    { name: 'an owner with auto top-up off', facts: {}, kind: 'checkbox' },
    {
      name: 'auto top-up already on',
      facts: { settings: settings('on') },
      kind: 'on'
    },
    {
      name: 'auto top-up on hold',
      facts: { settings: settings('on_hold') },
      kind: 'hidden'
    },
    {
      name: 'a member',
      facts: { canManageAutoTopUp: false },
      kind: 'hidden'
    },
    {
      name: 'a setup frozen for past due',
      facts: { setup: { state: 'frozen', reason: 'payment_past_due' } },
      kind: 'hidden'
    },
    {
      name: 'a setup frozen only for a missing default card',
      facts: {
        setup: { state: 'frozen', reason: 'default_payment_method_missing' }
      },
      kind: 'checkbox'
    },
    {
      name: 'the rollout off',
      facts: { autoTopUpEnabled: false, settings: settings('on') },
      kind: 'hidden'
    },
    { name: 'unread settings', facts: { settings: null }, kind: 'hidden' }
  ])('$name shows $kind', ({ facts, kind }) => {
    expect(addCreditsAutoTopUpOffer({ ...OWNER, ...facts }).kind).toBe(kind)
  })

  it('carries the served rules and the default card into the checkbox', () => {
    const defaultCard = { brand: 'Visa', last4: '4242' }
    expect(addCreditsAutoTopUpOffer({ ...OWNER, defaultCard })).toEqual({
      kind: 'checkbox',
      rules: RULES,
      defaultCard
    })
  })
})
