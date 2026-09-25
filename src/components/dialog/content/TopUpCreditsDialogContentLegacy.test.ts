import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { createI18n } from 'vue-i18n'

import { useToast } from '@/components/ui/toast'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useBillingRouting } from '@/composables/billing/useBillingRouting'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { useTelemetry } from '@/platform/telemetry'
import type { PaymentIntentSource } from '@/platform/telemetry/types'
import { AuthStoreError, useAuthStore } from '@/stores/authStore'
import { useDialogStore } from '@/stores/dialogStore'

import TopUpCreditsDialogContentLegacy from './TopUpCreditsDialogContentLegacy.vue'

const PENDING_TOPUP_KEY = 'pending_topup_timestamp'

const mockShouldUseWorkspaceBilling = vi.hoisted(() => ({ value: false }))

vi.mock(import('@/composables/billing/useBillingContext'))

vi.mock(import('@/composables/billing/useBillingRouting'))

vi.mock(import('@/platform/cloud/subscription/composables/useSubscription'))

vi.mock(import('@/platform/settings/composables/useSettingsDialog'))

vi.mock(import('@/platform/telemetry'))

vi.mock(import('@/base/credits/comfyCredits'), () => ({
  creditsToUsd: (credits: number) => credits,
  usdToCredits: (usd: number) => usd
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { close: 'Close', increment: 'Increment', decrement: 'Decrement' },
      credits: {
        topUp: {
          addMoreCredits: 'Add more credits',
          addMoreCreditsToRun: 'Add more credits to run',
          selectAmount: 'Select amount',
          youPay: 'You pay',
          youGet: 'You get',
          purchaseError: 'Purchase Failed',
          purchaseErrorDetail: 'Failed to purchase credits: {error}',
          unknownError: 'An unknown error occurred',
          minRequired: 'Minimum required',
          maxAllowed: 'Maximum allowed',
          needMore: 'Need more?',
          contactUs: 'Contact us',
          viewPricing: 'View pricing',
          insufficientWorkflowMessage: 'Insufficient credits',
          buyCredits: 'Continue to payment'
        }
      }
    }
  }
})

function renderDialog(props: { source?: PaymentIntentSource } = {}) {
  return render(TopUpCreditsDialogContentLegacy, {
    props,
    global: {
      config: { errorHandler: () => {} },
      plugins: [i18n]
    }
  })
}

async function clickBuyCredits() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Continue to payment' }))
}

describe('TopUpCreditsDialogContentLegacy', () => {
  beforeEach(() => {
    localStorage.clear()
    useBillingRouting().shouldUseWorkspaceBilling = computed(
      () => mockShouldUseWorkspaceBilling.value
    )
    vi.mocked(useSubscription().isSubscriptionEnabled).mockReturnValue(true)
    mockShouldUseWorkspaceBilling.value = false
    const billingContext = useBillingContext()
    vi.mocked(useBillingContext).mockReturnValue(billingContext)
    billingContext.canAccessSubscriptionFeatures = computed(() => true)
    vi.mocked(useAuthStore().initiateCreditPurchase).mockResolvedValue({
      checkout_url: 'https://checkout.stripe.test'
    })
    vi.spyOn(window, 'open').mockImplementation(() => window)
  })

  it.for([
    {
      name: 'a preset',
      choose: async (user: ReturnType<typeof userEvent.setup>) => {
        await user.click(screen.getByRole('button', { name: '$25' }))
      },
      reported: { amount_cents: 2500, amount_preset: '25' }
    },
    {
      name: 'a typed amount',
      choose: async (user: ReturnType<typeof userEvent.setup>) => {
        const payInput = screen.getByRole('spinbutton', { name: 'You pay' })
        await user.tripleClick(payInput)
        await user.keyboard('75{Enter}')
      },
      reported: { amount_cents: 7500, amount_preset: 'custom' }
    },
    {
      name: 'a typed amount that equals a preset',
      choose: async (user: ReturnType<typeof userEvent.setup>) => {
        const payInput = screen.getByRole('spinbutton', { name: 'You pay' })
        await user.tripleClick(payInput)
        await user.keyboard('100{Enter}')
      },
      reported: { amount_cents: 10000, amount_preset: 'custom' }
    }
  ])(
    'reports the amount and the preset of $name on the started event',
    async ({ choose, reported }) => {
      renderDialog({ source: 'deep_link' })

      await choose(userEvent.setup())
      await clickBuyCredits()

      expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledWith({
        operation: 'topup',
        stage: 'started',
        outcome: 'pending',
        payment_intent_source: 'deep_link',
        ...reported
      })
    }
  )

  it.for([
    {
      name: 'a rejected purchase',
      purchase: () => Promise.reject(new Error('declined')),
      expectedEvents: [
        [
          {
            operation: 'topup',
            stage: 'started',
            outcome: 'pending',
            payment_intent_source: 'deep_link',
            amount_cents: 5000,
            amount_preset: '50'
          }
        ],
        [
          {
            operation: 'topup',
            stage: 'failed',
            outcome: 'failure',
            failure_category: 'unknown',
            payment_intent_source: 'deep_link'
          }
        ]
      ]
    },
    {
      name: 'a checkout that opens',
      purchase: () =>
        Promise.resolve({ checkout_url: 'https://checkout.stripe.test' }),
      expectedEvents: [
        [
          {
            operation: 'topup',
            stage: 'started',
            outcome: 'pending',
            payment_intent_source: 'deep_link',
            amount_cents: 5000,
            amount_preset: '50'
          }
        ]
      ]
    }
  ])(
    'reports the surface it was opened from on the events of $name',
    async ({ purchase, expectedEvents }) => {
      vi.mocked(useAuthStore().initiateCreditPurchase).mockImplementation(
        purchase
      )
      renderDialog({ source: 'deep_link' })
      await clickBuyCredits()

      const telemetry = useTelemetry()
      assert.exists(telemetry)
      expect(vi.mocked(telemetry.trackBillingEvent).mock.calls).toEqual(
        expectedEvents
      )
    }
  )

  it('shows Plan & Credits after a successful Cloud purchase', async () => {
    renderDialog()
    await clickBuyCredits()

    expect(useAuthStore().initiateCreditPurchase).toHaveBeenCalledWith({
      amount_micros: 50_000_000,
      currency: 'usd'
    })
    expect(useDialogStore().closeDialog).toHaveBeenCalled()
    expect(useSettingsDialog().show).toHaveBeenCalledWith('workspace')
    expect(localStorage.getItem(PENDING_TOPUP_KEY)).not.toBeNull()
  })

  it('clamps a typed amount to the ceiling and warns until another amount is chosen', async () => {
    renderDialog()
    const user = userEvent.setup()
    const payInput = screen.getByRole('spinbutton', { name: 'You pay' })

    await user.tripleClick(payInput)
    await user.keyboard('20000{Enter}')

    expect(payInput).toHaveValue('10,000')
    expect(screen.getByRole('spinbutton', { name: 'You get' })).toHaveValue(
      '10,000'
    )
    expect(screen.getByText('Maximum allowed')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '$25' }))

    expect(payInput).toHaveValue('25')
    expect(screen.queryByText('Maximum allowed')).not.toBeInTheDocument()
  })

  it('steps the credits field by the amount tier without deselecting the preset on blur', async () => {
    renderDialog()
    const user = userEvent.setup()
    const payInput = screen.getByRole('spinbutton', { name: 'You pay' })

    await user.click(payInput)
    await user.tab()
    expect(screen.getByRole('button', { name: '$50' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    const creditsIncrement = screen.getAllByRole('button', {
      name: 'Increment'
    })[1]
    await user.click(creditsIncrement)

    expect(payInput).toHaveValue('55')
    expect(screen.getByRole('button', { name: '$50' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  it('clears the pending top-up marker when the user closes the dialog', async () => {
    localStorage.setItem(PENDING_TOPUP_KEY, Date.now().toString())

    renderDialog()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(localStorage.getItem(PENDING_TOPUP_KEY)).toBeNull()
    expect(useDialogStore().closeDialog).toHaveBeenCalled()
  })

  it('shows Plan & Credits when no billing rail is active', async () => {
    vi.mocked(useSubscription().isSubscriptionEnabled).mockReturnValue(false)

    renderDialog()
    await clickBuyCredits()

    expect(useSettingsDialog().show).toHaveBeenCalledWith('workspace')
  })

  it('shows the workspace settings panel when workspace billing is active', async () => {
    mockShouldUseWorkspaceBilling.value = true

    renderDialog()
    await clickBuyCredits()

    expect(useSettingsDialog().show).toHaveBeenCalledWith('workspace')
  })

  it('tracks the failure and surfaces a toast when the purchase rejects', async () => {
    vi.mocked(useAuthStore().initiateCreditPurchase).mockRejectedValue(
      new Error('declined for person@example.com')
    )

    renderDialog()
    await clickBuyCredits()

    expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledWith({
      operation: 'topup',
      stage: 'failed',
      outcome: 'failure',
      failure_category: 'unknown'
    })
    expect(useToast().toasts).toContainEqual(
      expect.objectContaining({
        kind: 'error',
        title: 'Purchase Failed'
      })
    )
    expect(useSettingsDialog().show).not.toHaveBeenCalled()
  })

  it('categorizes an auth-store rejection with an HTTP status via the shared classifier', async () => {
    vi.mocked(useAuthStore().initiateCreditPurchase).mockRejectedValue(
      new AuthStoreError('backend rejected the purchase', 400)
    )

    renderDialog()
    await clickBuyCredits()

    expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledWith({
      operation: 'topup',
      stage: 'failed',
      outcome: 'failure',
      failure_category: 'api_rejected'
    })
  })

  it('categorizes an auth-store rejection with no HTTP status as a network failure', async () => {
    vi.mocked(useAuthStore().initiateCreditPurchase).mockRejectedValue(
      new AuthStoreError('offline')
    )

    renderDialog()
    await clickBuyCredits()

    expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledWith({
      operation: 'topup',
      stage: 'failed',
      outcome: 'failure',
      failure_category: 'network'
    })
  })

  it.for([
    {
      name: 'a checkout that opens stays pending',
      purchase: () =>
        Promise.resolve({ checkout_url: 'https://checkout.stripe.test' }),
      openedWindow: window,
      expectedEvents: [
        [
          {
            operation: 'topup',
            stage: 'started',
            outcome: 'pending',
            amount_cents: 5000,
            amount_preset: '50'
          }
        ]
      ],
      markerKept: true,
      settingsCalls: [['workspace']]
    },
    {
      name: 'a rejected purchase closes as failed',
      purchase: () => Promise.reject(new Error('declined')),
      openedWindow: window,
      expectedEvents: [
        [
          {
            operation: 'topup',
            stage: 'started',
            outcome: 'pending',
            amount_cents: 5000,
            amount_preset: '50'
          }
        ],
        [
          {
            operation: 'topup',
            stage: 'failed',
            outcome: 'failure',
            failure_category: 'unknown'
          }
        ]
      ],
      markerKept: false,
      settingsCalls: []
    },
    {
      name: 'a checkout tab the browser blocks closes as a popup-blocked failure',
      purchase: () =>
        Promise.resolve({ checkout_url: 'https://checkout.stripe.test' }),
      openedWindow: null,
      expectedEvents: [
        [
          {
            operation: 'topup',
            stage: 'started',
            outcome: 'pending',
            amount_cents: 5000,
            amount_preset: '50'
          }
        ],
        [
          {
            operation: 'topup',
            stage: 'failed',
            outcome: 'failure',
            failure_category: 'redirect',
            error_code: 'payment_popup_blocked'
          }
        ]
      ],
      markerKept: false,
      settingsCalls: []
    }
  ])(
    'opens every purchase attempt with one started event: $name',
    async ({
      purchase,
      openedWindow,
      expectedEvents,
      markerKept,
      settingsCalls
    }) => {
      vi.mocked(useAuthStore().initiateCreditPurchase).mockImplementation(
        purchase
      )
      vi.spyOn(window, 'open').mockImplementation(() => openedWindow)

      renderDialog()
      await clickBuyCredits()

      const telemetry = useTelemetry()
      assert.exists(telemetry)
      expect(vi.mocked(telemetry.trackBillingEvent).mock.calls).toEqual(
        expectedEvents
      )
      expect(localStorage.getItem(PENDING_TOPUP_KEY) !== null).toBe(markerKept)
      expect(vi.mocked(useSettingsDialog().show).mock.calls).toEqual(
        settingsCalls
      )
    }
  )

  it('sends no started event when the customer cannot buy credits', async () => {
    useBillingContext().canAccessSubscriptionFeatures = computed(() => false)

    renderDialog()
    await clickBuyCredits()

    const telemetry = useTelemetry()
    assert.exists(telemetry)
    expect(vi.mocked(telemetry.trackBillingEvent).mock.calls).toEqual([])
    expect(useAuthStore().initiateCreditPurchase).not.toHaveBeenCalled()
    expect(localStorage.getItem(PENDING_TOPUP_KEY)).toBeNull()
    expect(useSettingsDialog().show).toHaveBeenCalledWith('workspace')
  })

  it('uses the same bounded category when the rejection is not an Error', async () => {
    vi.mocked(useAuthStore().initiateCreditPurchase).mockRejectedValue('boom')

    renderDialog()
    await clickBuyCredits()

    expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledWith({
      operation: 'topup',
      stage: 'failed',
      outcome: 'failure',
      failure_category: 'unknown'
    })
  })
})
vi.mock(import('firebase/auth'))
