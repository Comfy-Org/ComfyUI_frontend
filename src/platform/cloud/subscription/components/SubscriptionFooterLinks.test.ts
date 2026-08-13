import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import SubscriptionFooterLinks from './SubscriptionFooterLinks.vue'

const state = vi.hoisted(() => ({
  isCloud: true,
  manageSubscription: vi.fn(),
  handleLearnMoreClick: vi.fn(),
  handleMessageSupport: vi.fn()
}))

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return state.isCloud
  }
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
    state.isCloud = true
  })

  it('renders working support links without a duplicate invoice action', async () => {
    const user = userEvent.setup()
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
    renderComponent()

    expect(
      screen.queryByRole('button', { name: 'Invoice history' })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Learn more' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Partner Nodes pricing' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Message support' })
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Learn more' }))
    expect(state.handleLearnMoreClick).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: 'Message support' }))
    expect(state.handleMessageSupport).toHaveBeenCalledOnce()

    await user.click(
      screen.getByRole('button', { name: 'Partner Nodes pricing' })
    )
    expect(openSpy).toHaveBeenCalledWith(
      'https://docs.comfy.org/partner-nodes',
      '_blank'
    )
  })

  it('keeps Invoice history working outside the cloud distribution', async () => {
    const user = userEvent.setup()
    state.isCloud = false
    renderComponent()

    await user.click(screen.getByRole('button', { name: 'Invoice history' }))

    expect(state.manageSubscription).toHaveBeenCalledOnce()
  })

  it('hides Invoice history from local users without billing permission', () => {
    state.isCloud = false
    renderComponent(false)

    expect(
      screen.queryByRole('button', { name: 'Invoice history' })
    ).not.toBeInTheDocument()
    expect(state.manageSubscription).not.toHaveBeenCalled()
  })
})
