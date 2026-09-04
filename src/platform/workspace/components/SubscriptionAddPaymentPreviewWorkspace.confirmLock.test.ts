import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'

import type {
  PreviewSubscribeResponse,
  SavedPaymentMethod
} from '@/platform/workspace/api/workspaceApi'

import SubscriptionAddPaymentPreviewWorkspace from './SubscriptionAddPaymentPreviewWorkspace.vue'

/**
 * Real i18n on purpose: the sibling suite mocks vue-i18n, so it can only see
 * translation keys. These assert the button the way a customer reads it.
 */
const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages },
  missingWarn: false,
  fallbackWarn: false
})

const previewData: PreviewSubscribeResponse = {
  allowed: true,
  amount_due_cents: 3500,
  cost_today_cents: 3500,
  cost_next_period_cents: 3500,
  credits_today_cents: 0,
  credits_next_period_cents: 0,
  currency: 'usd',
  effective_at: '2026-06-19T00:00:00Z',
  is_immediate: true,
  transition_type: 'upgrade',
  quote_id: 'q_1',
  quote_version: 1,
  new_plan: {
    slug: 'creator-monthly',
    tier: 'CREATOR',
    duration: 'MONTHLY',
    price_cents: 3500,
    credits_cents: 0,
    period_end: '2027-06-28T00:00:00Z',
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
        failureDetail?: string
      }
    | { reconciliationOperationId: string }
) {
  return render(SubscriptionAddPaymentPreviewWorkspace, {
    props: {
      tierKey: 'creator',
      embeddedCheckoutEnabled: true,
      previewData,
      quoteIsCurrent: true,
      savedMethods: [
        {
          id: 'pm_1',
          type: 'card',
          brand: 'visa',
          last4: '4242',
          is_default: true
        } satisfies SavedPaymentMethod
      ],
      ...recovery
    },
    global: {
      plugins: [i18n],
      stubs: { UnifiedStripePaymentSelector: true }
    }
  })
}

describe('SubscriptionAddPaymentPreviewWorkspace — confirm lock', () => {
  it('keeps the pay action live after a failed challenge', () => {
    renderPreview({ authenticationState: 'failed_retryable' })

    // The intent has fallen back to requires_payment_method; a fresh attempt
    // is the only way forward, so the action that starts one must not be
    // locked behind the failure that ended the last one.
    expect(
      screen.getByRole('button', { name: 'Pay and subscribe' })
    ).toBeEnabled()
  })

  it('locks the pay action during a reconciliation hold', () => {
    renderPreview({ reconciliationOperationId: 'op_1' })

    expect(
      screen.getByRole('button', { name: 'Pay and subscribe' })
    ).toBeDisabled()
  })

  it('names the bank verdict under the failure notice when there is one', () => {
    renderPreview({
      authenticationState: 'failed_retryable',
      canRetryAuthentication: true,
      failureDetail: 'Your card has insufficient funds.'
    })

    expect(
      screen.getByText('Your card has insufficient funds.')
    ).toBeInTheDocument()
  })

  it('offers a different card from the failure notice', async () => {
    const { emitted } = renderPreview({
      authenticationState: 'failed_retryable',
      canRetryAuthentication: true
    })

    expect(screen.getByRole('alert')).toHaveTextContent(
      "Verification didn't finish."
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'use a different card' })
    )
    expect(emitted().changePaymentMethod).toBeTruthy()
  })

  it('locks the pay action while a challenge is still open', () => {
    renderPreview({ authenticationState: 'requires_action' })

    expect(
      screen.getByRole('button', { name: 'Pay and subscribe' })
    ).toBeDisabled()
  })
})
