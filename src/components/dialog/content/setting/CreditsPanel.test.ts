import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import type { BalanceInfo } from '@/composables/billing/types'

import CreditsPanel from './CreditsPanel.vue'

const billingMocks = vi.hoisted(() => ({
  balance: { value: null as BalanceInfo | null },
  manageSubscription: vi.fn()
}))
vi.mock('@/composables/billing/useBillingContext', async () => {
  const { ref } = await import('vue')
  const balance = ref<BalanceInfo | null>(null)
  Object.defineProperty(billingMocks, 'balance', { get: () => balance })
  return {
    useBillingContext: () => ({
      balance,
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

function makeBalance(amountMicros: number): BalanceInfo {
  return {
    amountMicros,
    currency: 'usd',
    effectiveBalanceMicros: amountMicros,
    prepaidBalanceMicros: 0,
    cloudCreditBalanceMicros: 0
  }
}

describe('CreditsPanel', () => {
  beforeEach(() => {
    billingMocks.balance.value = null
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

  it('refreshes activity on a balance change but not on first hydration', async () => {
    renderComponent()

    billingMocks.balance.value = makeBalance(5000)
    await nextTick()
    expect(refreshActivity).not.toHaveBeenCalled()

    billingMocks.balance.value = makeBalance(9000)
    await nextTick()
    expect(refreshActivity).toHaveBeenCalledOnce()
  })
})
