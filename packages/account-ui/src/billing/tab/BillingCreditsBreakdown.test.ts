import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type {
  CreditsFlyoutPlan,
  CreditsFlyoutState
} from '@comfyorg/account-core/billing'

import BillingCreditsBreakdown from './BillingCreditsBreakdown.vue'
import { creditsBreakdownCopy } from './__fixtures__/creditsCardCopy'

const PLAN: CreditsFlyoutPlan = {
  kind: 'plan',
  availableCents: 1100,
  planCents: 1000,
  planPoolCredits: 8440,
  topUpCents: 100,
  topUpInUse: false,
  showUsage: true,
  planDate: { kind: 'refills', date: '2026-10-28T00:00:00Z' },
  cadence: 'monthly'
}

function renderBreakdown(state: CreditsFlyoutState, note?: string) {
  render(BillingCreditsBreakdown, {
    props: { state, copy: creditsBreakdownCopy, locale: 'en' },
    slots: note ? { topUpNote: `<p>${note}</p>` } : {}
  })
}

const textOf = (testId: string) =>
  screen.queryByTestId(testId)?.textContent.trim() ?? null
const plan = () => textOf('credits-breakdown-plan')
const topUp = () => textOf('credits-breakdown-top-up')
const meter = () => screen.queryByRole('meter')
const shows = (text: string) => screen.queryByText(text) !== null

describe('BillingCreditsBreakdown', () => {
  it('shows plan credits of the plan total, the used bar, the refill date and top-up', () => {
    renderBreakdown(PLAN)

    expect(shows('Plan credits')).toBe(true)
    expect(plan()).toBe('2,110 of 8,440')
    expect(meter()?.getAttribute('aria-valuenow')).toBe('75')
    expect(shows('Refills October 28')).toBe(true)
    expect(shows('Top-up credits')).toBe(true)
    expect(topUp()).toBe('211')
  })

  it('keeps the year on a yearly plan', () => {
    renderBreakdown({ ...PLAN, cadence: 'yearly' })

    expect(shows('Refills October 28, 2026')).toBe(true)
  })

  it('fills the bar when the plan pool is used up', () => {
    renderBreakdown({ ...PLAN, planCents: 0 })

    expect(plan()).toBe('0 of 8,440')
    expect(meter()?.getAttribute('aria-valuenow')).toBe('100')
  })

  it('refills after the payment goes through', () => {
    renderBreakdown({ ...PLAN, planDate: { kind: 'afterPayment' } })

    expect(shows('Refills when the payment goes through')).toBe(true)
  })

  it.for([
    { case: 'not served', planPoolCredits: null },
    { case: 'zero', planPoolCredits: 0 }
  ])(
    'shows remaining plan credits without a total or bar when the total is $case',
    ({ planPoolCredits }) => {
      renderBreakdown({ ...PLAN, planPoolCredits })

      expect(plan()).toBe('2,110')
      expect(meter()).toBeNull()
    }
  )

  it('shows top-up credits only, with the host note, when there is no plan', () => {
    renderBreakdown(
      { kind: 'noPlan', topUpCents: 100 },
      "Buying credits doesn't start a Cloud plan."
    )

    expect(shows('Plan credits')).toBe(false)
    expect(meter()).toBeNull()
    expect(topUp()).toBe('211')
    expect(shows("Buying credits doesn't start a Cloud plan.")).toBe(true)
  })

  it('shows dashes and no bar when the balance is unavailable', () => {
    renderBreakdown({ kind: 'unavailable' })

    expect(plan()).toBe('—')
    expect(topUp()).toBe('—')
    expect(meter()).toBeNull()
    expect(screen.getByRole('alert').textContent.trim()).toBe(
      "Couldn't load your balance."
    )
  })

  it('shows skeletons while loading', () => {
    renderBreakdown({ kind: 'loading' })

    expect(shows('Plan credits')).toBe(true)
    expect(plan()).toBeNull()
    expect(topUp()).toBeNull()
    expect(meter()).toBeNull()
  })
})
