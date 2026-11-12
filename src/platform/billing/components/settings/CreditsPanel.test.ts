import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import type { BalanceInfo } from '@/platform/billing/composables/types'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { mockBillingContext } from '@/utils/__tests__/mockBillingContext'

import CreditsPanel from './CreditsPanel.vue'

vi.mock(import('@/platform/billing/composables/useBillingContext'))

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
  import('@/platform/billing/subscription/components/CreditsTile.vue'),
  () => ({
    default: defineComponent({
      setup: () => () => h('div', { 'data-testid': 'credits-tile-current' })
    })
  })
)
vi.mock(
  import('@/platform/billing/legacy160/platform/billing/subscription/components/CreditsTile.vue'),
  () => ({
    default: defineComponent({
      setup: () => () => h('div', { 'data-testid': 'credits-tile-1.60' })
    })
  })
)
vi.mock(import('@/composables/useFeatureFlags'))

vi.mock(import('@comfyorg/telemetry'))

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
  function renderComponent() {
    return render(CreditsPanel, {
      global: { plugins: [i18n], stubs: { Divider: true } }
    })
  }

  it.for([
    { enabled: false, tile: 'credits-tile-1.60' },
    { enabled: true, tile: 'credits-tile-current' }
  ])(
    'renders the $tile credits tile with billing_new_ux_enabled $enabled',
    ({ enabled, tile }) => {
      mockBillingContext()
      vi.mocked(useFeatureFlags().flags).billingNewUxEnabled = enabled
      renderComponent()

      expect(screen.getByTestId(tile)).toBeInTheDocument()
      expect(
        screen.queryByTestId(
          enabled ? 'credits-tile-1.60' : 'credits-tile-current'
        )
      ).not.toBeInTheDocument()
    }
  )

  it('opens the billing portal for the active billing rail', async () => {
    const billing = mockBillingContext()
    const user = userEvent.setup()
    renderComponent()

    await user.click(screen.getByRole('button', { name: /Invoice History/ }))

    expect(billing.manageSubscription).toHaveBeenCalledOnce()
  })

  it('refreshes activity on a balance change but not on first hydration', async () => {
    const billing = mockBillingContext()
    const balance = ref<BalanceInfo | null>(null)
    billing.balance = computed(() => balance.value)
    renderComponent()

    balance.value = makeBalance(5000)
    await nextTick()
    expect(refreshActivity).not.toHaveBeenCalled()

    balance.value = makeBalance(9000)
    await nextTick()
    expect(refreshActivity).toHaveBeenCalledOnce()
  })
})
