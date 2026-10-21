import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

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
    quote_id: 'quote_123',
    quote_version: 1,
    amount_due_cents: priceCents,
    currency: 'usd',
    renewal_amount_cents: priceCents,
    renewal_at: '2027-06-19T00:00:00Z',
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

// Only the renewal messages are supplied, so the renewal assertions verify
// real interpolated output while every other key still renders as itself.
const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      subscription: {
        preview: {
          renewsAt: 'Renews at {amount} on {date}. Cancel anytime.',
          renewsAtAmount: 'Renews at {amount}. Cancel anytime.'
        }
      }
    }
  }
})

const globalOptions = {
  plugins: [i18n],
  stubs: {
    'i18n-t': { template: '<span />' }
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
    expect(screen.queryByText('$380.00')).toBeNull()
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
    expect(screen.queryByText('$336.00')).toBeNull()
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
    expect(screen.queryByText('$4,560.00')).toBeNull()
  })

  it('emits addCreditCard from the team confirm CTA', async () => {
    const { emitted } = render(SubscriptionAddPaymentPreviewWorkspace, {
      props: {
        teamPlan: { usd: 400, credits: 84_400, discountedUsd: 380 },
        previewData: previewFixture('MONTHLY', 38_000)
      },
      global: globalOptions
    })
    await userEvent.click(
      screen.getByText('subscription.preview.subscribeToPlan')
    )
    expect(emitted().addCreditCard).toBeTruthy()
  })

  it('opens verification only from its button without exposing the URL', async () => {
    const actionUrl = 'https://verify.example/sensitive-token'
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window)
    const { container } = render(SubscriptionAddPaymentPreviewWorkspace, {
      props: { tierKey: 'creator', actionUrl },
      global: globalOptions
    })

    expect(open).not.toHaveBeenCalled()
    expect(container.innerHTML).not.toContain(actionUrl)
    await userEvent.click(
      screen.getByRole('button', {
        name: 'subscription.preview.completeVerification'
      })
    )
    expect(open).toHaveBeenCalledWith(
      actionUrl,
      '_blank',
      'noopener,noreferrer'
    )
  })

  it('hides the standard subscribe action during parked-checkout recovery', () => {
    render(SubscriptionAddPaymentPreviewWorkspace, {
      props: { tierKey: 'creator', parkedCheckoutRecovery: true },
      global: globalOptions
    })

    // Both emit addCreditCard; rendering them together offers the same action twice.
    expect(
      screen.queryByRole('button', {
        name: /subscription\.preview\.(subscribeToPlan|payAndSubscribe)/
      })
    ).toBeNull()
  })

  it('retries the subscribe from the parked-checkout prompt', async () => {
    const { emitted } = render(SubscriptionAddPaymentPreviewWorkspace, {
      props: { tierKey: 'creator', parkedCheckoutRecovery: true },
      global: globalOptions
    })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'subscription.preview.parkedCheckoutDetail'
    )
    await userEvent.click(
      screen.getByRole('button', {
        name: 'subscription.preview.completePayment'
      })
    )
    expect(emitted().addCreditCard).toBeTruthy()
  })

  it('locks subscribing while an earlier payment awaits verification', () => {
    render(SubscriptionAddPaymentPreviewWorkspace, {
      props: {
        tierKey: 'creator',
        actionUrl: 'https://verify.example/sensitive-token'
      },
      global: globalOptions
    })

    expect(
      screen.getByText('subscription.preview.pendingVerificationDetail')
    ).toBeTruthy()
    expect(
      screen.getByRole('button', {
        name: 'subscription.preview.subscribeToPlan'
      })
    ).toBeDisabled()
  })

  it('withholds a stale verification link once the last attempt failed', () => {
    render(SubscriptionAddPaymentPreviewWorkspace, {
      props: {
        tierKey: 'creator',
        authenticationState: 'failed_retryable',
        actionUrl: 'https://verify.example/sensitive-token'
      },
      global: globalOptions
    })

    expect(
      screen.queryByRole('button', {
        name: 'subscription.preview.completeVerification'
      })
    ).toBeNull()
  })

  it('owns a back action', async () => {
    const { emitted } = render(SubscriptionAddPaymentPreviewWorkspace, {
      props: { tierKey: 'creator' },
      global: globalOptions
    })

    await userEvent.click(screen.getByRole('button', { name: 'g.back' }))

    expect(emitted().back).toBeTruthy()
  })

  it('omits the total row entirely when no quote is available to price it', () => {
    render(SubscriptionAddPaymentPreviewWorkspace, {
      props: {
        teamPlan: { usd: 700, credits: 147_700, discountedUsd: 665 },
        previewData: null
      },
      global: globalOptions
    })

    expect(screen.queryByText('subscription.preview.totalDueToday')).toBeNull()
  })

  it('prices a legacy preview from the server costs instead of rendering a blank total', () => {
    const {
      amount_due_cents,
      currency,
      renewal_amount_cents,
      renewal_at,
      quote_id,
      quote_version,
      ...legacy
    } = previewFixture('MONTHLY', 2000)

    render(SubscriptionAddPaymentPreviewWorkspace, {
      props: { tierKey: 'creator', previewData: legacy },
      global: globalOptions
    })

    expect(screen.getByText('$20.00')).toBeTruthy()
    expect(
      screen.getByText('Renews at $20.00 on Jun 19, 2027. Cancel anytime.')
    ).toBeTruthy()
  })
})
