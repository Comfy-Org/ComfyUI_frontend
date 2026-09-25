import { cleanup, render, screen } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import type { StripePaymentPhase } from '@comfyorg/account-ui/billing/stripe'

import type { CheckoutJourneyTelemetryEvent } from '@/platform/telemetry/types'
import {
  clearCheckoutJourney,
  resolveCheckoutJourney
} from '@/platform/workspace/utils/checkoutJourney'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'

import UnifiedStripePaymentSelector from './UnifiedStripePaymentSelector.vue'

const mockTrackCheckoutJourneyEvent = vi.hoisted(() =>
  vi.fn<(event: CheckoutJourneyTelemetryEvent) => void>()
)
vi.mock<unknown>(import('@/platform/telemetry'), () => ({
  useTelemetry: () => ({
    trackCheckoutJourneyEvent: mockTrackCheckoutJourneyEvent
  })
}))

/**
 * The provider work is covered in the package, against the real Stripe mocks.
 * What is left here is the binding: the key, the copy, the button and the
 * journey context the form cannot know about.
 */
const formProps = vi.hoisted(() => ({ value: {} as Record<string, unknown> }))
let reportPhase: (phase: StripePaymentPhase) => void = () => {}

vi.mock<unknown>(import('@comfyorg/account-ui/billing/stripe'), () => ({
  StripePaymentForm: {
    name: 'StripePaymentForm',
    props: {
      publishableKey: { type: String, default: '' },
      amountCents: { type: Number, default: 0 },
      currency: { type: String, default: '' },
      copy: { type: Object, default: () => ({}) },
      paymentMethodConfigurationId: { type: String, default: '' },
      isLoading: { type: Boolean, default: false },
      verificationPending: { type: Boolean, default: false },
      canSubmit: { type: Boolean, default: true },
      themeKey: { type: String, default: '' }
    },
    emits: ['confirm', 'submittingChange', 'phase'],
    setup(
      props: Record<string, unknown>,
      {
        emit,
        slots
      }: {
        emit: (event: string, payload: unknown) => void
        slots: { submit?: (slotProps: Record<string, unknown>) => unknown }
      }
    ) {
      formProps.value = props
      reportPhase = (phase) => emit('phase', phase)
      return () =>
        slots.submit?.({
          disabled: props.verificationPending,
          loading: props.isLoading,
          verificationPending: props.verificationPending
        })
    }
  }
}))

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
          payAndSubscribe: 'Pay and subscribe',
          stripeUnavailable: 'Stripe is unavailable'
        }
      }
    }
  }
})

function renderSelector(props: Record<string, unknown> = {}) {
  return render(UnifiedStripePaymentSelector, {
    props: {
      amountCents: 66500,
      currency: 'usd',
      paymentMethodConfigurationId: 'pmc_test',
      ...props
    },
    global: { plugins: [i18n] }
  })
}

describe('UnifiedStripePaymentSelector', () => {
  beforeEach(() => {
    sessionStorage.clear()
    clearCheckoutJourney()
    mockTrackCheckoutJourneyEvent.mockClear()
    vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY', 'pk_test_example')
  })

  afterEach(cleanup)

  it('hands the form this deployment key and the host translations', () => {
    renderSelector()

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
    renderSelector()
    const colorPaletteStore = useColorPaletteStore()

    colorPaletteStore.activePaletteId = 'light'
    await nextTick()

    expect(formProps.value.themeKey).toBe('light')
  })

  it('renders the pay action into the form through the submit slot', () => {
    renderSelector({ verificationPending: true })

    // Stepping back behind Complete verification is the host's decision, so
    // the disabled state has to survive the slot rather than live in the form.
    expect(
      screen.getByRole<HTMLButtonElement>('button', {
        name: 'Pay and subscribe'
      }).disabled
    ).toBe(true)
  })

  it('stamps the active journey onto a phase the form reports', () => {
    const seeded = resolveCheckoutJourney({
      actorUid: 'user-1',
      workspaceId: 'ws-1',
      entryFlow: 'initial_subscription',
      entrySource: 'pricing',
      assignment: { status: 'resolved', arm: 'treatment' }
    })
    renderSelector()

    reportPhase({ phase: 'payment_element_ready', element: 'payment' })

    expect(mockTrackCheckoutJourneyEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        checkout_journey_id:
          seeded.status === 'active' ? seeded.record.journey_id : '',
        phase: 'payment_element_ready',
        element: 'payment'
      })
    )
  })

  it('drops a phase that arrives with no active journey', () => {
    renderSelector()
    clearCheckoutJourney()

    reportPhase({ phase: 'payment_submit_attempted' })

    expect(mockTrackCheckoutJourneyEvent).not.toHaveBeenCalled()
  })
})
