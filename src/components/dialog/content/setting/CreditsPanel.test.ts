import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import type { Ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { mockBillingContext } from '@/utils/__tests__/mockBillingContext'

import CreditsPanel from './CreditsPanel.vue'

vi.mock(import('@/composables/billing/useBillingContext'))

const refreshActivity = vi.hoisted(() => vi.fn())
vi.mock<unknown>(import('./UsageLogsTable.vue'), async () => {
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

vi.mock(
  import('@/platform/cloud/subscription/components/CreditsTile.vue'),
  () => ({
    default: defineComponent({ setup: () => () => h('div') })
  })
)

vi.mock(import('@/platform/telemetry'))

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
    refreshActivity.mockClear()
  })

  function renderComponent() {
    return render(CreditsPanel, {
      global: { plugins: [i18n], stubs: { Divider: true } }
    })
  }

  it('opens the billing portal for the active billing rail', async () => {
    const billing = mockBillingContext()
    const user = userEvent.setup()
    renderComponent()

    await user.click(screen.getByRole('button', { name: /Invoice History/ }))

    expect(billing.manageSubscription).toHaveBeenCalledOnce()
  })

  it('refreshes activity when the shared billing signal changes', async () => {
    const billing = mockBillingContext()
    renderComponent()
    screen.getByTestId('usage-logs-table')
    expect(refreshActivity).not.toHaveBeenCalled()

    ;(billing.usageLogsRefreshSignal as Ref<number>).value++
    await vi.waitFor(() => expect(refreshActivity).toHaveBeenCalledOnce())
  })
})
