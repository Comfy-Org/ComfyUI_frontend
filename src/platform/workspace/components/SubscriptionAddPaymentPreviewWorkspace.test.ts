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

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    n: (value: number) => value.toLocaleString('en-US'),
    locale: { value: 'en' }
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
  // Stripe Elements configure themselves once from the amount and currency, so
  // mounting the selector before the quote lands leaves it permanently
  // unusable. The team checkout renders its preview step while the quote is
  // still in flight, which is how "payment options are unavailable" reached
  // customers holding a perfectly good quote.
  it('withholds the payment element until the quote is usable, then renders it', async () => {
    let selectorInstances = 0
    const { rerender } = render(SubscriptionAddPaymentPreviewWorkspace, {
      props: {
        teamPlan: { usd: 700, credits: 147_700, discountedUsd: 665 },
        usePaymentElement: true
      },
      global: {
        ...globalOptions,
        stubs: {
          ...globalOptions.stubs,
          UnifiedStripePaymentSelector: {
            name: 'UnifiedStripePaymentSelector',
            props: ['amountCents', 'currency'],
            template:
              '<div data-testid="payment-selector">{{ amountCents }}/{{ currency }}</div>',
            setup() {
              selectorInstances += 1
            }
          }
        }
      }
    })

    expect(screen.queryByTestId('payment-selector')).toBeNull()

    await rerender({ previewData: previewFixture('MONTHLY', 66_500) })

    expect(screen.getByTestId('payment-selector')).toHaveTextContent(
      '66500/usd'
    )
    expect(selectorInstances).toBe(1)

    await rerender({
      previewData: {
        ...previewFixture('MONTHLY', 50_000),
        quote_id: 'quote_456',
        quote_version: 2
      }
    })

    expect(screen.getByTestId('payment-selector')).toHaveTextContent(
      '50000/usd'
    )
    expect(selectorInstances).toBe(2)
  })

  it('submits a zero-dollar quote without mounting Stripe Elements', async () => {
    const quote = previewFixture('MONTHLY', 0)
    const { emitted } = render(SubscriptionAddPaymentPreviewWorkspace, {
      props: {
        tierKey: 'creator',
        previewData: quote,
        usePaymentElement: true,
        quoteIsCurrent: true
      },
      global: {
        ...globalOptions,
        stubs: {
          ...globalOptions.stubs,
          UnifiedStripePaymentSelector: {
            template: '<div data-testid="payment-selector" />'
          }
        }
      }
    })

    expect(screen.queryByTestId('payment-selector')).toBeNull()
    await userEvent.click(
      screen.getByText('subscription.preview.payAndSubscribe')
    )
    expect(emitted().addCreditCard).toBeTruthy()
  })

  it('falls back to subscription confirmation when quote identity is missing', async () => {
    const quote = previewFixture('MONTHLY', 3500)
    delete quote.quote_id
    delete quote.quote_version
    const { emitted } = render(SubscriptionAddPaymentPreviewWorkspace, {
      props: {
        tierKey: 'creator',
        previewData: quote,
        usePaymentElement: true,
        quoteIsCurrent: true
      },
      global: {
        ...globalOptions,
        stubs: {
          ...globalOptions.stubs,
          UnifiedStripePaymentSelector: {
            template: '<div data-testid="payment-selector" />'
          }
        }
      }
    })

    expect(screen.queryByTestId('payment-selector')).toBeNull()
    await userEvent.click(
      screen.getByText('subscription.preview.payAndSubscribe')
    )
    expect(emitted().addCreditCard).toBeTruthy()
  })

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
        previewData: previewFixture('MONTHLY', 38_000),
        quoteIsCurrent: true
      },
      global: globalOptions
    })
    await userEvent.click(
      screen.getByText('subscription.preview.subscribeToPlan')
    )
    expect(emitted().addCreditCard).toBeTruthy()
  })

  it('invalidates while editing a promo and applies only on button click', async () => {
    const { emitted } = render(SubscriptionAddPaymentPreviewWorkspace, {
      props: {
        tierKey: 'creator',
        previewData: previewFixture('MONTHLY', 3500),
        quoteIsCurrent: true,
        embeddedCheckoutEnabled: true
      },
      global: globalOptions
    })
    const input = screen.getByPlaceholderText(
      'subscription.preview.promoCodePlaceholder'
    )

    await userEvent.type(input, 'SAVE20')
    expect(emitted().invalidateQuote).toBeTruthy()
    expect(emitted().applyPromotionCode).toBeUndefined()

    await userEvent.click(
      screen.getByText('subscription.preview.applyPromoCode')
    )
    expect(emitted().applyPromotionCode?.at(-1)).toEqual(['SAVE20'])
  })

  it('offers Add new payment method from the saved-method picker', async () => {
    const { emitted } = render(SubscriptionAddPaymentPreviewWorkspace, {
      props: {
        tierKey: 'creator',
        previewData: previewFixture('MONTHLY', 3500),
        quoteIsCurrent: true,
        embeddedCheckoutEnabled: true,
        selectedSavedMethodId: 'pm_default',
        savedMethods: [
          {
            type: 'card',
            id: 'pm_default',
            brand: 'visa',
            last4: '4242',
            is_default: true
          },
          { type: 'alipay', id: 'pm_alipay', is_default: false }
        ]
      },
      global: {
        ...globalOptions,
        stubs: {
          ...globalOptions.stubs,
          SingleSelect: {
            props: ['options'],
            emits: ['update:modelValue'],
            template:
              '<button v-for="option in options" @click="$emit(\'update:modelValue\', option.value)">{{ option.name }}</button>'
          }
        }
      }
    })

    await userEvent.click(
      screen.getByText('subscription.preview.addNewPaymentMethod')
    )
    expect(emitted()['update:selectedSavedMethodId']).toEqual([[null]])
    expect(emitted().changePaymentMethod).toBeTruthy()
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

  it('renders an explicit retry action after failed verification', async () => {
    const { emitted } = render(SubscriptionAddPaymentPreviewWorkspace, {
      props: {
        tierKey: 'creator',
        embeddedCheckoutEnabled: true,
        authenticationState: 'failed_retryable',
        authenticationError: 'Challenge was closed',
        canRetryAuthentication: true
      },
      global: globalOptions
    })

    expect(screen.getByRole('alert')).toHaveTextContent('Challenge was closed')
    await userEvent.click(
      screen.getByRole('button', {
        name: 'billingOperation.retryVerification'
      })
    )
    expect(emitted().retryAuthentication).toBeTruthy()
  })

  it('shows reconciliation support guidance with the operation id', () => {
    render(SubscriptionAddPaymentPreviewWorkspace, {
      props: {
        tierKey: 'creator',
        embeddedCheckoutEnabled: true,
        reconciliationOperationId: 'op-reconcile-123'
      },
      global: globalOptions
    })

    expect(
      screen.getByText('billingOperation.reconciliationTitle')
    ).toBeTruthy()
    expect(screen.getByText('op-reconcile-123')).toBeTruthy()
  })

  it('does not render a back action on the payment confirmation', () => {
    render(SubscriptionAddPaymentPreviewWorkspace, {
      props: { tierKey: 'creator', isLoading: true },
      global: globalOptions
    })

    expect(
      screen.queryByRole('button', {
        name: 'subscription.preview.backToAllPlans'
      })
    ).toBeNull()
  })
})
