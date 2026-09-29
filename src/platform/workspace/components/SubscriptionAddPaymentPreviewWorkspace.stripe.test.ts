import { cleanup, render } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import type { StripePaymentPhase } from '@comfyorg/account-ui/billing/stripe'

import { useTelemetry } from '@/platform/telemetry'
import type { PreviewSubscribeResponse } from '@/platform/workspace/api/workspaceApi'
import {
  clearCheckoutJourney,
  resolveCheckoutJourney
} from '@/platform/workspace/utils/checkoutJourney'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'

import SubscriptionAddPaymentPreviewWorkspace from './SubscriptionAddPaymentPreviewWorkspace.vue'

vi.mock(import('@/platform/telemetry'))

/**
 * The card form itself is covered in the package. What is left here is the
 * app's binding: the key, the copy, the theme and the journey context the
 * form cannot know about.
 */
const formProps = vi.hoisted(() => ({ value: {} as Record<string, unknown> }))
let reportPhase: (phase: StripePaymentPhase) => void = () => {}

const PaymentFormStub = defineComponent({
  name: 'CheckoutPaymentForm',
  props: {
    publishableKey: { type: String, default: '' },
    copy: { type: Object, default: () => ({}) },
    themeKey: { type: String, default: '' }
  },
  emits: ['phase'],
  setup(props, { emit }) {
    formProps.value = props
    reportPhase = (phase) => emit('phase', phase)
    return () => null
  }
})

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { error: 'Error' },
      subscription: {
        preview: {
          paymentMethod: 'Payment method',
          billingAddress: 'Billing address',
          stripeMethodChoice: 'Choose a payment method',
          alipayRenewalNote: 'Alipay renewal note',
          stripeUnavailable: 'Stripe is unavailable'
        }
      }
    }
  }
})

const quote: PreviewSubscribeResponse = {
  allowed: true,
  transition_type: 'new_subscription',
  effective_at: '2026-06-19T00:00:00Z',
  is_immediate: true,
  cost_today_cents: 66_500,
  cost_next_period_cents: 66_500,
  credits_today_cents: 0,
  credits_next_period_cents: 0,
  quote_id: 'quote_123',
  quote_version: 1,
  amount_due_cents: 66_500,
  currency: 'usd',
  new_plan: {
    slug: 'creator',
    tier: 'CREATOR',
    duration: 'MONTHLY',
    price_cents: 66_500,
    credits_cents: 0,
    seat_summary: {
      seat_count: 1,
      total_cost_cents: 66_500,
      total_credits_cents: 0
    }
  }
}

function renderConfirm() {
  return render(SubscriptionAddPaymentPreviewWorkspace, {
    props: {
      tierKey: 'creator',
      previewData: quote,
      usePaymentElement: true,
      quoteIsCurrent: true
    },
    global: {
      plugins: [i18n],
      stubs: { CheckoutPaymentForm: PaymentFormStub }
    }
  })
}

describe('SubscriptionAddPaymentPreviewWorkspace payment binding', () => {
  beforeEach(() => {
    sessionStorage.clear()
    clearCheckoutJourney()
    vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY', 'pk_test_example')
  })

  afterEach(cleanup)

  it('hands the form this deployment key and the host translations', () => {
    renderConfirm()

    expect(formProps.value.publishableKey).toBe('pk_test_example')
    expect(formProps.value.copy).toStrictEqual({
      paymentMethod: 'Payment method',
      methodChoice: 'Choose a payment method',
      billingAddress: 'Billing address',
      alipayRenewalNote: 'Alipay renewal note',
      unavailable: 'Stripe is unavailable',
      genericError: 'Error'
    })
  })

  it('re-keys the form theme when the active colour palette changes', async () => {
    renderConfirm()
    const colorPaletteStore = useColorPaletteStore()

    colorPaletteStore.activePaletteId = 'light'
    await nextTick()

    expect(formProps.value.themeKey).toBe('light')
  })

  it('stamps the active journey onto a phase the form reports', () => {
    const seeded = resolveCheckoutJourney({
      actorUid: 'user-1',
      workspaceId: 'ws-1',
      entryFlow: 'initial_subscription',
      entrySource: 'pricing',
      assignment: { status: 'resolved', arm: 'treatment' }
    })
    renderConfirm()

    reportPhase({ phase: 'payment_element_ready', element: 'payment' })

    expect(useTelemetry()?.trackCheckoutJourneyEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        checkout_journey_id:
          seeded.status === 'active' ? seeded.record.journey_id : '',
        phase: 'payment_element_ready',
        element: 'payment'
      })
    )
  })

  it('drops a phase that arrives with no active journey', () => {
    renderConfirm()
    clearCheckoutJourney()

    reportPhase({ phase: 'payment_submit_attempted' })

    expect(useTelemetry()?.trackCheckoutJourneyEvent).not.toHaveBeenCalled()
  })
})
