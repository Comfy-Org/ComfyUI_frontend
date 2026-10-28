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
  billingStatus: 'paid',
  planPoolCredits: 1000,
  renewalDate: null
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
      facts: { billingStatus: 'paused', planKind: 'unknown' },
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

  it('ends the plan line with the renewal date', () => {
    renderCard({
      ...activeFacts,
      renewalDate: '2026-10-01T00:00:00Z'
    })

    expect(screen.getByTestId('billing-credits-plan').textContent.trim()).toBe(
      '844 of 1,000 Refills October 1, 2026'
    )
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
    expect(screen.getByTestId('billing-credits-plan')).toHaveClass(
      'font-semibold'
    )
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
