import { render, screen } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { createI18n } from 'vue-i18n'

import type { PaymentIntentSource } from '@/platform/telemetry/types'

import SubscriptionRequiredDialogContent from './SubscriptionRequiredDialogContent.vue'

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    canAccessSubscriptionFeatures: computed(() => false)
  })
}))
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
        plansForWorkspace: 'Plans for {workspace}',
        personalWorkspace: 'Personal',
        perMonth: 'per month',
        haveQuestions: 'Questions?',
        contactUs: 'Contact us',
        viewEnterprise: 'View enterprise'
      }
    }
  }
})

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
  const originalConfig = window.__CONFIG__

  beforeEach(() => {
    window.__CONFIG__ = { subscription_required: true }
  })

  afterEach(() => {
    window.__CONFIG__ = originalConfig
  })

  it('gives the pricing table the source, not the copy reason', () => {
    renderComponent({
      reason: 'out_of_credits',
      paymentIntentSource: 'agent_paywall'
    })

    expect(screen.getByTestId('pricing-table')).toHaveTextContent(
      'agent_paywall'
    )
  })

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
