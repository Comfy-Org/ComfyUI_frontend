import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'

import type { PreviewSubscribeResponse } from '@/platform/workspace/api/workspaceApi'

import SubscriptionTransitionPreviewWorkspace from './SubscriptionTransitionPreviewWorkspace.vue'

const { mockSubscription } = vi.hoisted(() => ({
  mockSubscription: {
    value: null as { isCancelled: boolean; endDate: string | null } | null
  }
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    subscription: computed(() => mockSubscription.value)
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages },
  missingWarn: false,
  fallbackWarn: false
})

const previewData: PreviewSubscribeResponse = {
  allowed: true,
  transition_type: 'upgrade',
  effective_at: '2026-08-01T00:00:00Z',
  is_immediate: true,
  cost_today_cents: 1500,
  cost_next_period_cents: 3500,
  credits_today_cents: 0,
  credits_next_period_cents: 0,
  quote_id: 'quote_1',
  quote_version: 1,
  amount_due_cents: 1500,
  currency: 'usd',
  renewal_amount_cents: 3500,
  renewal_at: '2026-09-15T00:00:00Z',
  new_plan: {
    slug: 'creator-monthly',
    tier: 'CREATOR',
    duration: 'MONTHLY',
    price_cents: 3500,
    credits_cents: 0,
    period_end: '2026-09-15T00:00:00Z',
    seat_summary: {
      seat_count: 1,
      total_cost_cents: 3500,
      total_credits_cents: 0
    }
  }
}

function renderPreview(props: Record<string, unknown> = {}) {
  mockSubscription.value = { isCancelled: false, endDate: null }
  return render(SubscriptionTransitionPreviewWorkspace, {
    props: {
      previewData,
      quoteIsCurrent: true,
      embeddedCheckoutEnabled: true,
      ...props
    },
    global: { plugins: [i18n] }
  })
}

describe('SubscriptionTransitionPreviewWorkspace — challenge lock', () => {
  it.for([
    ['an open bank tab', { actionUrl: 'https://verify.example/token' }],
    ['requires_action', { authenticationState: 'requires_action' }],
    ['a reconciliation hold', { reconciliationOperationId: 'op_1' }]
  ] as const)('locks back during %s', ([, props]) => {
    renderPreview(props)

    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled()
  })

  it('frees back after a failed challenge, even with a lingering actionUrl', () => {
    renderPreview({
      actionUrl: 'https://verify.example/expired',
      authenticationState: 'failed_retryable'
    })

    expect(screen.getByRole('button', { name: 'Back' })).toBeEnabled()
  })

  it('leaves back usable before a charge is in flight', () => {
    renderPreview()

    expect(screen.getByRole('button', { name: 'Back' })).toBeEnabled()
  })
})
