import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import SubscriptionFooterLinks from './SubscriptionFooterLinks.vue'

const state = vi.hoisted(() => ({
  manageSubscription: vi.fn(),
  handleLearnMoreClick: vi.fn(),
  handleMessageSupport: vi.fn()
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    manageSubscription: state.manageSubscription
  })
}))

vi.mock('@/composables/useExternalLink', () => ({
  useExternalLink: () => ({
    buildDocsUrl: vi.fn(() => 'https://docs.comfy.org/partner-nodes'),
    docsPaths: { partnerNodesPricing: 'partner-nodes' }
  })
}))

vi.mock(
  '@/platform/cloud/subscription/composables/useSubscriptionActions',
  () => ({
    useSubscriptionActions: () => ({
      isLoadingSupport: ref(false),
      handleLearnMoreClick: state.handleLearnMoreClick,
      handleMessageSupport: state.handleMessageSupport
    })
  })
)

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      subscription: {
        learnMore: 'Learn more',
        partnerNodesPricingTable: 'Partner Nodes pricing',
        messageSupport: 'Message support',
        invoiceHistory: 'Invoice history'
      }
    }
  }
})

function renderComponent(showInvoiceHistory?: boolean) {
  return render(SubscriptionFooterLinks, {
    props: showInvoiceHistory === undefined ? {} : { showInvoiceHistory },
    global: {
      plugins: [i18n],
      stubs: {
        Button: {
          props: ['loading'],
          emits: ['click'],
          template: '<button @click="$emit(\'click\')"><slot /></button>'
        }
      }
    }
  })
}

describe('SubscriptionFooterLinks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps Invoice history visible by default for legacy billing', async () => {
    const user = userEvent.setup()
    renderComponent()

    await user.click(screen.getByRole('button', { name: 'Invoice history' }))

    expect(state.manageSubscription).toHaveBeenCalledOnce()
  })

  it('hides Invoice history without opening the payment portal', () => {
    renderComponent(false)

    expect(
      screen.queryByRole('button', { name: 'Invoice history' })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Learn more' })
    ).toBeInTheDocument()
    expect(state.manageSubscription).not.toHaveBeenCalled()
  })
})
