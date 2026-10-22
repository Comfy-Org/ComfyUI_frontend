import { render, screen } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import type { PaymentIntentSource } from '@/platform/telemetry/types'
import { useDialogStore } from '@/stores/dialogStore'

import SubscriptionRequiredDialogContent from './SubscriptionRequiredDialogContent.vue'

vi.mock(import('@/platform/billing/composables/useBillingContext'))
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

const stubs = {
  PricingTable: PricingTableStub,
  CloudBadge: { template: '<div />' },
  SubscribeButton: { template: '<div />' },
  SubscriptionBenefits: { template: '<div />' }
}

function renderComponent(props: {
  reason?: PaymentIntentSource
  paymentIntentSource: PaymentIntentSource | undefined
}) {
  return render(SubscriptionRequiredDialogContent, {
    props: { onClose: vi.fn(), ...props },
    global: {
      plugins: [i18n],
      stubs
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

  it('names the legacy panel dialog by its reason-specific title', async () => {
    window.__CONFIG__ = { subscription_required: false }

    render(GlobalDialog, { global: { plugins: [i18n], stubs } })
    useDialogStore().showDialog({
      key: 'subscription-required',
      component: SubscriptionRequiredDialogContent,
      props: {
        onClose: vi.fn(),
        reason: 'out_of_credits',
        paymentIntentSource: 'agent_paywall'
      },
      dialogComponentProps: { headless: true }
    })

    expect(
      await screen.findByRole('dialog', { name: 'Insufficient Credits' })
    ).toBeInTheDocument()
    expect(screen.queryByTestId('pricing-table')).not.toBeInTheDocument()
  })
})
