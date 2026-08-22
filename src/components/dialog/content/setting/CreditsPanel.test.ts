import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createI18n } from 'vue-i18n'

import CreditsPanel from './CreditsPanel.vue'

const billingMocks = vi.hoisted(() => ({
  usageLogsRefreshSignal: { value: 0 },
  manageSubscription: vi.fn()
}))
vi.mock('@/composables/billing/useBillingContext', async () => {
  const { ref } = await import('vue')
  const usageLogsRefreshSignal = ref(0)
  Object.defineProperty(billingMocks, 'usageLogsRefreshSignal', {
    get: () => usageLogsRefreshSignal
  })
  return {
    useBillingContext: () => ({
      usageLogsRefreshSignal,
      manageSubscription: billingMocks.manageSubscription
    })
  }
})

const refreshActivity = vi.hoisted(() => vi.fn())
vi.mock('./UsageLogsTable.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({
      setup(_props, { expose }) {
        expose({ refresh: refreshActivity })
        return () => h('div', { 'data-testid': 'usage-logs-table' })
      }
    })
  }
})

vi.mock('@/platform/cloud/subscription/components/CreditsTile.vue', () => ({
  default: defineComponent({ setup: () => () => h('div') })
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({ trackHelpResourceClicked: vi.fn() })
}))

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({ execute: vi.fn() })
}))

vi.mock('@/composables/useExternalLink', () => ({
  useExternalLink: () => ({
    buildDocsUrl: () => 'https://docs.comfy.org',
    docsPaths: { partnerNodesPricing: '/partner-nodes' }
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      credits: {
        credits: 'Credits',
        activity: 'Activity',
        invoiceHistory: 'Invoice History',
        faqs: 'FAQs',
        messageSupport: 'Message Support'
      },
      subscription: { partnerNodesCredits: 'Partner Nodes Credits' }
    }
  }
})

describe('CreditsPanel', () => {
  beforeEach(() => {
    billingMocks.usageLogsRefreshSignal.value = 0
    refreshActivity.mockClear()
  })

  function renderComponent() {
    return render(CreditsPanel, {
      global: { plugins: [i18n], stubs: { Divider: true } }
    })
  }

  it('opens the billing portal for the active billing rail', async () => {
    const user = userEvent.setup()
    renderComponent()

    await user.click(screen.getByRole('button', { name: /Invoice History/ }))

    expect(billingMocks.manageSubscription).toHaveBeenCalledOnce()
  })

  it('refreshes activity when the shared billing signal changes', async () => {
    renderComponent()
    screen.getByTestId('usage-logs-table')
    expect(refreshActivity).not.toHaveBeenCalled()

    billingMocks.usageLogsRefreshSignal.value++
    await vi.waitFor(() => expect(refreshActivity).toHaveBeenCalledOnce())
  })
})
