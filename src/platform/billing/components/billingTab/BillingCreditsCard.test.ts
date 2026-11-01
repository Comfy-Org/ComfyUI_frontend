import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { BalanceInfo } from '@/platform/billing/composables/types'
import enMessages from '@/locales/en/main.json'
import { deriveCreditsCard } from '@/platform/billing/components/billingTab/creditsCard'
import type { CreditsCardFacts } from '@/platform/billing/components/billingTab/creditsCard'

import BillingCreditsCard from './BillingCreditsCard.vue'

function balanceOf(cents: {
  effective: number
  plan: number
  topUp: number
}): BalanceInfo {
  return {
    amountMicros: cents.plan + cents.topUp,
    currency: 'usd',
    effectiveBalanceMicros: cents.effective,
    effectiveBalanceAuthoritative: true,
    prepaidBalanceMicros: cents.topUp,
    cloudCreditBalanceMicros: cents.plan
  }
}

const activeFacts: CreditsCardFacts = {
  balance: balanceOf({ effective: 700, plan: 400, topUp: 300 }),
  planKind: 'active',
  servedPlanKind: 'self_serve',
  billingStatus: 'paid',
  periodCreditGrant: null,
  planPoolCredits: 1000,
  renewalDate: null,
  endDate: null
}

const SUBSCRIBE_NOTE =
  "Buying credits doesn't start a Cloud plan. Subscribe to run workflows on Cloud."

const CARD_NOTES = [
  'Your runs used 211 more credits than you had.',
  SUBSCRIBE_NOTE,
  "Couldn't load your balance."
]

function renderCard(
  facts: CreditsCardFacts,
  canTopUp = true,
  planCreditNote: string | null = null
) {
  return render(BillingCreditsCard, {
    props: { state: deriveCreditsCard(facts), canTopUp, planCreditNote },
    global: {
      plugins: [
        createI18n({
          legacy: false,
          locale: 'en',
          messages: { en: enMessages }
        })
      ]
    }
  })
}

describe('BillingCreditsCard', () => {
  it.for<{
    case: string
    facts: Partial<CreditsCardFacts>
    canTopUp?: boolean
    planCreditNote?: string
    available: string
    plan: string | null
    topUp: string | null
    inUse: boolean
    addCredits: boolean
    notes: string[]
  }>([
    {
      case: 'an active plan with both pools',
      facts: {},
      available: '1,477',
      plan: '844 of 1,000',
      topUp: '633',
      inUse: false,
      addCredits: true,
      notes: []
    },
    {
      case: 'plan credits used up while top-up remains',
      facts: { balance: balanceOf({ effective: 1000, plan: 0, topUp: 1000 }) },
      available: '2,110',
      plan: '0 of 1,000',
      topUp: '2,110',
      inUse: true,
      addCredits: true,
      notes: []
    },
    {
      case: 'a plan whose credit grant is unknown',
      facts: { planPoolCredits: null },
      available: '1,477',
      plan: '844',
      topUp: '633',
      inUse: false,
      addCredits: true,
      notes: []
    },
    {
      case: 'a paused plan keeps the real balance and empties the plan line',
      facts: { billingStatus: 'paused', planKind: 'paused' },
      available: '1,477',
      plan: '0 of 1,000',
      topUp: '633',
      inUse: false,
      addCredits: true,
      notes: []
    },
    {
      case: 'a negative balance with pools held at zero',
      facts: { balance: balanceOf({ effective: -100, plan: 0, topUp: 50 }) },
      available: '-211',
      plan: '0 of 1,000',
      topUp: '0',
      inUse: false,
      addCredits: true,
      notes: ['Your runs used 211 more credits than you had.']
    },
    {
      case: 'no plan with the served plan-required note',
      facts: {
        planKind: 'noPlan',
        balance: balanceOf({ effective: 200, plan: 0, topUp: 200 })
      },
      planCreditNote: SUBSCRIBE_NOTE,
      available: '422',
      plan: null,
      topUp: null,
      inUse: false,
      addCredits: true,
      notes: [SUBSCRIBE_NOTE]
    },
    {
      case: 'an ended plan without a note',
      facts: {
        planKind: 'ended',
        balance: balanceOf({ effective: 200, plan: 0, topUp: 200 })
      },
      available: '422',
      plan: null,
      topUp: null,
      inUse: false,
      addCredits: true,
      notes: []
    },
    {
      case: 'a Free plan with the served plan-required note',
      facts: {},
      planCreditNote: SUBSCRIBE_NOTE,
      available: '1,477',
      plan: '844 of 1,000',
      topUp: '633',
      inUse: false,
      addCredits: true,
      notes: [SUBSCRIBE_NOTE]
    },
    {
      case: 'a server that refuses top-up',
      facts: {},
      canTopUp: false,
      available: '1,477',
      plan: '844 of 1,000',
      topUp: '633',
      inUse: false,
      addCredits: false,
      notes: []
    },
    {
      case: 'a balance whose pending charges were not read',
      facts: {
        balance: {
          ...balanceOf({ effective: 700, plan: 400, topUp: 300 }),
          effectiveBalanceAuthoritative: false
        }
      },
      available: '—',
      plan: null,
      topUp: null,
      inUse: false,
      addCredits: false,
      notes: ["Couldn't load your balance."]
    },
    {
      case: 'a failed balance read',
      facts: { balance: null },
      available: '—',
      plan: null,
      topUp: null,
      inUse: false,
      addCredits: false,
      notes: ["Couldn't load your balance."]
    }
  ])('renders $case', (row) => {
    renderCard(
      { ...activeFacts, ...row.facts },
      row.canTopUp ?? true,
      row.planCreditNote ?? null
    )

    expect(
      screen.getByTestId('billing-credits-available').textContent.trim()
    ).toBe(row.available)
    expect(
      screen.queryByTestId('billing-credits-plan')?.textContent.trim() ?? null
    ).toBe(row.plan)
    expect(
      screen.queryByTestId('billing-credits-top-up')?.textContent.trim() ?? null
    ).toBe(row.topUp)
    expect(screen.queryByText('In use now') !== null).toBe(row.inUse)
    expect(screen.queryByRole('button', { name: 'Add credits' }) !== null).toBe(
      row.addCredits
    )
    expect(CARD_NOTES.filter((note) => screen.queryByText(note))).toEqual(
      row.notes
    )
  })

  it.for<{
    case: string
    facts: Partial<CreditsCardFacts>
    amount: string
    date: string
    used: string | null
    meter: string | null
  }>([
    {
      case: 'an active plan refills on its renewal date',
      facts: { renewalDate: '2026-10-01T00:00:00Z' },
      amount: '844 of 1,000',
      date: 'Refills October 1, 2026',
      used: '16% used',
      meter: '16'
    },
    {
      case: 'a sales-managed plan has no refill date',
      facts: {
        planKind: 'salesManaged',
        servedPlanKind: 'sales_managed',
        renewalDate: '2026-10-01T00:00:00Z'
      },
      amount: '844 of 1,000',
      date: '',
      used: '16% used',
      meter: '16'
    },
    {
      case: 'a plan without a served plan kind has no refill date',
      facts: { servedPlanKind: null, renewalDate: '2026-10-01T00:00:00Z' },
      amount: '844 of 1,000',
      date: '',
      used: '16% used',
      meter: '16'
    },
    {
      case: 'a sales-managed plan the row cannot name has no refill date',
      facts: {
        planKind: 'unknown',
        servedPlanKind: 'sales_managed',
        billingStatus: 'paused',
        renewalDate: '2026-10-01T00:00:00Z'
      },
      amount: '0 of 1,000',
      date: '',
      used: null,
      meter: null
    },
    {
      case: 'an ending plan is available until its end date',
      facts: {
        planKind: 'ending',
        renewalDate: '2026-10-01T00:00:00Z',
        endDate: '2026-12-31T12:00:00Z'
      },
      amount: '844 of 1,000',
      date: 'Available until December 31, 2026',
      used: '16% used',
      meter: '16'
    },
    {
      case: 'a plan with no known total shows no meter',
      facts: { planPoolCredits: null, renewalDate: '2026-10-01T00:00:00Z' },
      amount: '844',
      date: 'Refills October 1, 2026',
      used: null,
      meter: null
    },
    {
      case: 'a paused plan keeps the pool but shows no usage',
      facts: {
        billingStatus: 'paused',
        planKind: 'paused',
        renewalDate: '2026-10-01T00:00:00Z'
      },
      amount: '0 of 1,000',
      date: 'Refills when the payment goes through',
      used: null,
      meter: null
    },
    {
      case: 'used-up plan credits fill the meter',
      facts: { balance: balanceOf({ effective: 300, plan: 0, topUp: 300 }) },
      amount: '0 of 1,000',
      date: '',
      used: '100% used',
      meter: '100'
    }
  ])('splits the plan cell for $case', (row) => {
    renderCard({ ...activeFacts, ...row.facts })

    expect(screen.getByTestId('billing-credits-plan').textContent.trim()).toBe(
      row.amount
    )
    expect(
      screen.queryByTestId('billing-credits-plan-date')?.textContent.trim() ??
        ''
    ).toBe(row.date)
    expect(
      screen.queryByTestId('billing-credits-plan-used')?.textContent.trim() ??
        null
    ).toBe(row.used)
    expect(
      screen.queryByRole('meter')?.getAttribute('aria-valuenow') ?? null
    ).toBe(row.meter)
  })

  it.for<{
    case: string
    grant: CreditsCardFacts['periodCreditGrant']
    plan: string | null
    topUp: string | null
    meter: string | null
  }>([
    {
      case: 'an amount grant as the plan total',
      grant: { state: 'amount', credits: 2000, period: 'MONTHLY' },
      plan: '844 of 2,000',
      topUp: '633',
      meter: '58'
    },
    {
      case: 'an unknown grant without a total or meter',
      grant: { state: 'unknown' },
      plan: '844',
      topUp: '633',
      meter: null
    },
    {
      case: 'a none grant as Available alone',
      grant: { state: 'none' },
      plan: null,
      topUp: null,
      meter: null
    },
    {
      case: 'an absent grant with the plan pool fallback',
      grant: null,
      plan: '844 of 1,000',
      topUp: '633',
      meter: '16'
    }
  ])('renders $case', ({ grant, plan, topUp, meter }) => {
    renderCard({ ...activeFacts, periodCreditGrant: grant })

    expect(
      screen.getByTestId('billing-credits-available').textContent.trim()
    ).toBe('1,477')
    expect(
      screen.queryByTestId('billing-credits-plan')?.textContent.trim() ?? null
    ).toBe(plan)
    expect(
      screen.queryByTestId('billing-credits-top-up')?.textContent.trim() ?? null
    ).toBe(topUp)
    expect(
      screen.queryByRole('meter')?.getAttribute('aria-valuenow') ?? null
    ).toBe(meter)
    expect(screen.getByRole('button', { name: 'Add credits' })).toBeVisible()
  })

  it('shows nothing under the amount without a date or a total', () => {
    renderCard({ ...activeFacts, planPoolCredits: null })

    expect(screen.queryByTestId('billing-credits-plan-date')).toBeNull()
    expect(screen.queryByRole('meter')).toBeNull()
  })

  it('waits for the payment instead of a renewal date on a paused plan', () => {
    renderCard({
      ...activeFacts,
      billingStatus: 'paused',
      planKind: 'paused',
      renewalDate: '2026-11-23T00:00:00Z'
    })

    expect(
      screen.getByTestId('billing-credits-plan-date').textContent.trim()
    ).toBe('Refills when the payment goes through')
    expect(screen.queryByRole('meter')).toBeNull()
  })

  it('puts the credits title above a 12px card', () => {
    renderCard(activeFacts)

    expect(screen.getByRole('heading', { name: /^Credits/ })).toHaveClass(
      'text-base',
      'font-medium',
      'gap-1.5'
    )
    expect(screen.getByTestId('billing-credits-surface')).toHaveClass(
      'rounded-xl',
      'border-card'
    )
    expect(screen.getByTestId('billing-credits-available')).toHaveClass(
      'text-2xl',
      'font-medium'
    )
    expect(screen.getByText('844')).toHaveClass('font-semibold')
  })

  it('asks for the balance again from Try again', async () => {
    const { emitted } = renderCard({ ...activeFacts, balance: null })

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(emitted('retry')).toHaveLength(1)
  })

  it('opens the top-up flow from Add credits', async () => {
    const { emitted } = renderCard(activeFacts)

    await userEvent.click(screen.getByRole('button', { name: 'Add credits' }))

    expect(emitted('addCredits')).toHaveLength(1)
  })
})
