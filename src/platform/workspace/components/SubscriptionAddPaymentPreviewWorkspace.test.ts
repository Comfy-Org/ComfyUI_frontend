import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import type {
  PreviewSubscribeResponse,
  SubscriptionDuration
} from '@/platform/workspace/api/workspaceApi'

import SubscriptionAddPaymentPreviewWorkspace from './SubscriptionAddPaymentPreviewWorkspace.vue'

function previewFixture(
  duration: SubscriptionDuration,
  priceCents: number
): PreviewSubscribeResponse {
  return {
    allowed: true,
    transition_type: 'new_subscription',
    effective_at: '2026-06-19T00:00:00Z',
    is_immediate: true,
    cost_today_cents: priceCents,
    cost_next_period_cents: priceCents,
    credits_today_cents: 0,
    credits_next_period_cents: 0,
    new_plan: {
      slug: 'creator',
      tier: 'CREATOR',
      duration,
      price_cents: priceCents,
      credits_cents: 0,
      seat_summary: {
        seat_count: 1,
        total_cost_cents: priceCents,
        total_credits_cents: 0
      },
      period_end: '2027-06-19T00:00:00Z'
    }
  }
}

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    n: (value: number) => value.toLocaleString('en-US')
  })
}))

const globalOptions = {
  mocks: { $t: (key: string) => key },
  stubs: {
    'i18n-t': { template: '<span />' },
    Button: {
      template: '<button @click="$emit(\'click\')"><slot /></button>'
    }
  }
}

describe('SubscriptionAddPaymentPreviewWorkspace', () => {
  it('renders personal tier price and credits from tierKey', () => {
    render(SubscriptionAddPaymentPreviewWorkspace, {
      props: { tierKey: 'creator' },
      global: globalOptions
    })
    expect(screen.getByText('subscription.tiers.creator.name')).toBeTruthy()
    expect(screen.getByText('$35')).toBeTruthy()
  })

  it('renders the team plan from the selected slider stop', () => {
    render(SubscriptionAddPaymentPreviewWorkspace, {
      props: { teamPlan: { usd: 400, credits: 84_400, discountedUsd: 380 } },
      global: globalOptions
    })
    expect(screen.getByText('subscription.teamPlan.name')).toBeTruthy()
    expect(screen.getByText('$380')).toBeTruthy()
    expect(screen.getAllByText('84,400').length).toBeGreaterThan(0)
    expect(screen.getByText('$380.00')).toBeTruthy()
  })

  it('shows the monthly-equivalent price and annual total for a yearly preview', () => {
    render(SubscriptionAddPaymentPreviewWorkspace, {
      props: {
        tierKey: 'creator',
        billingCycle: 'yearly',
        previewData: previewFixture('ANNUAL', 33_600)
      },
      global: globalOptions
    })
    expect(screen.getByText('subscription.usdPerMonth')).toBeTruthy()
    expect(screen.getByText('$28')).toBeTruthy()
    expect(screen.getByText('subscription.billedYearly')).toBeTruthy()
    expect(screen.getByText('$336.00')).toBeTruthy()
    expect(
      screen.getByText('subscription.preview.eachYearCreditsRefill')
    ).toBeTruthy()
    expect(screen.getByText('88,800')).toBeTruthy()
  })

  it('divides the yearly price by twelve in the fallback path', () => {
    render(SubscriptionAddPaymentPreviewWorkspace, {
      props: { tierKey: 'creator', billingCycle: 'yearly' },
      global: globalOptions
    })
    expect(screen.getByText('$28')).toBeTruthy()
    expect(screen.getByText('subscription.billedYearly')).toBeTruthy()
    expect(screen.getByText('$336.00')).toBeTruthy()
  })

  it('omits the billed-yearly note for a monthly subscription', () => {
    render(SubscriptionAddPaymentPreviewWorkspace, {
      props: {
        tierKey: 'creator',
        billingCycle: 'monthly',
        previewData: previewFixture('MONTHLY', 3_500)
      },
      global: globalOptions
    })
    expect(screen.getByText('$35')).toBeTruthy()
    expect(screen.getByText('subscription.billedMonthly')).toBeTruthy()
    expect(screen.queryByText('subscription.billedYearly')).toBeNull()
    expect(
      screen.getByText('subscription.preview.eachMonthCreditsRefill')
    ).toBeTruthy()
    expect(
      screen.queryByText('subscription.preview.eachYearCreditsRefill')
    ).toBeNull()
  })

  it('shows the annual total for a yearly team plan', () => {
    render(SubscriptionAddPaymentPreviewWorkspace, {
      props: {
        billingCycle: 'yearly',
        teamPlan: { usd: 400, credits: 84_400, discountedUsd: 380 }
      },
      global: globalOptions
    })
    expect(screen.getByText('$380')).toBeTruthy()
    expect(screen.getByText('subscription.billedYearly')).toBeTruthy()
    expect(screen.getByText('$4560.00')).toBeTruthy()
  })

  it('emits addCreditCard from the team confirm CTA', async () => {
    const { emitted } = render(SubscriptionAddPaymentPreviewWorkspace, {
      props: { teamPlan: { usd: 400, credits: 84_400, discountedUsd: 380 } },
      global: globalOptions
    })
    await userEvent.click(
      screen.getByText('subscription.preview.subscribeToPlan')
    )
    expect(emitted().addCreditCard).toBeTruthy()
  })

  it('keeps the card checkout event unchanged for a personal plan', async () => {
    const { emitted } = render(SubscriptionAddPaymentPreviewWorkspace, {
      props: { tierKey: 'creator' },
      global: globalOptions
    })

    await userEvent.click(
      screen.getByText('subscription.preview.subscribeToPlan')
    )

    expect(emitted().addCreditCard).toBeTruthy()
  })

  it('runs the Alipay prototype locally without starting checkout', async () => {
    const { emitted } = render(SubscriptionAddPaymentPreviewWorkspace, {
      props: { tierKey: 'creator' },
      global: globalOptions
    })

    await userEvent.click(screen.getByText('subscription.preview.alipay'))
    await userEvent.click(
      screen.getByText('subscription.preview.continueWithAlipay')
    )

    expect(
      screen.getByText('subscription.preview.alipayHandoffTitle')
    ).toBeTruthy()
    expect(emitted().addCreditCard).toBeUndefined()

    await userEvent.click(
      screen.getByText('subscription.preview.simulateAlipayReturn')
    )

    expect(screen.getByText('subscription.preview.paymentPending')).toBeTruthy()
    expect(
      screen.getByText('subscription.preview.returnedFromAlipay')
    ).toBeTruthy()
    expect(emitted().addCreditCard).toBeUndefined()

    await userEvent.click(
      screen.getByText('subscription.preview.replayPrototype')
    )

    expect(screen.getByText('subscription.preview.card')).toBeTruthy()
    expect(screen.getByText('subscription.preview.alipay')).toBeTruthy()
  })
})
