import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'

import type { PreviewSubscribeResponse } from '@/platform/workspace/api/workspaceApi'

import SubscriptionTransitionPreviewWorkspace from './SubscriptionTransitionPreviewWorkspace.vue'

/**
 * Real i18n on purpose, mirroring the AddPayment confirm-lock suite: these
 * assert the confirm button the way a customer reads it. This is the
 * upgrade/downgrade path — the one where the staging repro of the locked
 * confirm was found.
 */
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

function renderPreview(
  recovery:
    | {
        authenticationState: 'failed_retryable' | 'requires_action'
        canRetryAuthentication?: boolean
      }
    | { reconciliationOperationId: string }
) {
  mockSubscription.value = { isCancelled: false, endDate: null }
  return render(SubscriptionTransitionPreviewWorkspace, {
    props: {
      previewData,
      quoteIsCurrent: true,
      embeddedCheckoutEnabled: true,
      ...recovery
    },
    global: { plugins: [i18n] }
  })
}

describe('SubscriptionTransitionPreviewWorkspace — confirm lock', () => {
  it('keeps the confirm action live after a failed challenge', async () => {
    const { emitted } = renderPreview({
      authenticationState: 'failed_retryable',
      canRetryAuthentication: true
    })

    const confirm = screen.getByRole('button', { name: 'Confirm upgrade' })
    expect(confirm).toBeEnabled()
    await userEvent.click(confirm)
    expect(emitted().confirm).toBeTruthy()
  })

  it('locks the confirm action while a challenge is still open', () => {
    renderPreview({ authenticationState: 'requires_action' })

    expect(
      screen.getByRole('button', { name: 'Confirm upgrade' })
    ).toBeDisabled()
  })

  it('locks the confirm action during a reconciliation hold', () => {
    renderPreview({ reconciliationOperationId: 'op_1' })

    expect(
      screen.getByRole('button', { name: 'Confirm upgrade' })
    ).toBeDisabled()
  })
})
