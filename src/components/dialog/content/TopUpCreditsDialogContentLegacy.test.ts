import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { createI18n } from 'vue-i18n'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useBillingRouting } from '@/composables/billing/useBillingRouting'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { useTelemetry } from '@/platform/telemetry'
import { AuthStoreError, useAuthStore } from '@/stores/authStore'
import { useDialogStore } from '@/stores/dialogStore'

import TopUpCreditsDialogContentLegacy from './TopUpCreditsDialogContentLegacy.vue'

const PENDING_TOPUP_KEY = 'pending_topup_timestamp'

const mockToastAdd = vi.fn()

const mockShouldUseWorkspaceBilling = vi.hoisted(() => ({ value: false }))

vi.mock(import('@/composables/billing/useBillingContext'))

vi.mock(import('@/composables/billing/useBillingRouting'))

vi.mock(import('@/platform/cloud/subscription/composables/useSubscription'))

vi.mock(import('@/platform/settings/composables/useSettingsDialog'))

vi.mock(import('@/platform/telemetry'))

vi.mock<unknown>(
  import('primevue/usetoast'), // oxlint-disable-line comfy/no-primevue-imports

  () => ({
    useToast: () => ({ add: mockToastAdd })
  })
)

vi.mock(import('@/base/credits/comfyCredits'), () => ({
  creditsToUsd: (credits: number) => credits,
  usdToCredits: (usd: number) => usd
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { close: 'Close' },
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

function renderDialog() {
  return render(TopUpCreditsDialogContentLegacy, {
    global: {
      config: { errorHandler: () => {} },
      plugins: [i18n],
      stubs: {
        FormattedNumberStepper: {
          name: 'FormattedNumberStepper',
          props: ['modelValue'],
          template: '<div />'
        }
      }
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
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        summary: 'Purchase Failed'
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
        [{ operation: 'topup', stage: 'started', outcome: 'pending' }]
      ],
      markerKept: true,
      settingsCalls: [['workspace']]
    },
    {
      name: 'a rejected purchase closes as failed',
      purchase: () => Promise.reject(new Error('declined')),
      openedWindow: window,
      expectedEvents: [
        [{ operation: 'topup', stage: 'started', outcome: 'pending' }],
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
        [{ operation: 'topup', stage: 'started', outcome: 'pending' }],
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
