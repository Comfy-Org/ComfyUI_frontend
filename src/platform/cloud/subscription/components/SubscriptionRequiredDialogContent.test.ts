import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { PaymentIntentSource } from '@/platform/telemetry/types'

import SubscriptionRequiredDialogContent from './SubscriptionRequiredDialogContent.vue'

vi.mock(import('@/composables/billing/useBillingContext'))
vi.mock(import('@/platform/telemetry'))

vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { close: 'Close', or: 'or' },
      credits: {
        topUp: {
          insufficientTitle: 'Insufficient Credits',
          insufficientMessage: 'You are out of credits'
        }
      },
      subscription: {
        required: { title: 'Subscription required' },
        perMonth: 'per month',
        haveQuestions: 'Questions?',
        contactUs: 'Contact us',
        viewEnterprise: 'View enterprise'
      }
    }
  }
})

// Records the attribution value handed down, which is all this component owes
// the pricing table.
const PricingTableStub = {
  name: 'PricingTable',
  props: ['reason'],
  template: '<div data-testid="pricing-table">{{ reason ?? "none" }}</div>'
}

function renderComponent(props: {
  reason?: PaymentIntentSource
  paymentIntentSource: PaymentIntentSource | undefined
}) {
  return render(SubscriptionRequiredDialogContent, {
    props: { onClose: vi.fn(), ...props },
    global: {
      plugins: [i18n],
      stubs: {
        PricingTable: PricingTableStub,
        CloudBadge: { template: '<div />' },
        SubscribeButton: { template: '<div />' },
        SubscriptionBenefits: { template: '<div />' }
      }
    }
  })
}

describe('SubscriptionRequiredDialogContent', () => {
  beforeEach(() => {
    window.__CONFIG__ = { subscription_required: true }
  })

  // `PricingTable`'s `reason` prop is the payment intent source, so binding it
  // to this component's `reason` would re-attribute every purchase the top-up
  // fall-through sends here to the copy that fall-through rewrote.
  it.for([
    { reason: 'out_of_credits', paymentIntentSource: 'agent_paywall' },
    { reason: 'subscribe_to_run', paymentIntentSource: 'subscribe_to_run' }
  ] as const)(
    'gives the pricing table $paymentIntentSource, not the $reason copy',
    ({ reason, paymentIntentSource }) => {
      renderComponent({ reason, paymentIntentSource })

      expect(screen.getByTestId('pricing-table')).toHaveTextContent(
        paymentIntentSource
      )
    }
  )

  // The other arm of this component is the only place its `reason` reaches
  // copy, and it must keep reading `reason` rather than the source.
  it('still branches the legacy panel copy on the reason', () => {
    window.__CONFIG__ = { subscription_required: false }

    renderComponent({
      reason: 'out_of_credits',
      paymentIntentSource: 'agent_paywall'
    })

    expect(screen.queryByTestId('pricing-table')).not.toBeInTheDocument()
    expect(screen.getByText('Insufficient Credits')).toBeInTheDocument()
  })
})
