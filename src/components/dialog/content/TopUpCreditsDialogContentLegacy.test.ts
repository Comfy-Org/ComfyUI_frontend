import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import TopUpCreditsDialogContentLegacy from './TopUpCreditsDialogContentLegacy.vue'

const mockPurchaseCreditsDirect = vi.fn()
const mockShowSettings = vi.fn()
const mockToastAdd = vi.fn()
const mockCloseDialog = vi.fn()
const mockTrackTopUpPurchase = vi.fn()
const mockTrackBillingEvent = vi.fn()
const mockIsSubscriptionEnabled = vi.fn(() => true)
const mockShouldUseWorkspaceBilling = vi.hoisted(() => ({ value: false }))

vi.mock('@/composables/auth/useAuthActions', () => ({
  useAuthActions: () => ({
    purchaseCreditsDirect: (amount: number) => mockPurchaseCreditsDirect(amount)
  })
}))

vi.mock('@/composables/billing/useBillingRouting', () => ({
  useBillingRouting: () => ({
    shouldUseWorkspaceBilling: {
      get value() {
        return mockShouldUseWorkspaceBilling.value
      }
    }
  })
}))

vi.mock('@/platform/cloud/subscription/composables/useSubscription', () => ({
  useSubscription: () => ({
    isSubscriptionEnabled: mockIsSubscriptionEnabled
  })
}))

vi.mock('@/platform/settings/composables/useSettingsDialog', () => ({
  useSettingsDialog: () => ({ show: mockShowSettings })
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({ closeDialog: mockCloseDialog })
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackApiCreditTopupButtonPurchaseClicked: mockTrackTopUpPurchase,
    trackBillingEvent: mockTrackBillingEvent
  })
}))

vi.mock('@/platform/telemetry/topupTracker', () => ({
  clearTopupTracking: vi.fn()
}))

vi.mock('@/composables/useExternalLink', () => ({
  useExternalLink: () => ({
    buildDocsUrl: () => 'https://docs.comfy.org',
    docsPaths: { partnerNodesPricing: '' }
  })
}))

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: mockToastAdd })
}))

vi.mock('@/base/credits/comfyCredits', () => ({
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
    vi.clearAllMocks()
    mockIsSubscriptionEnabled.mockReturnValue(true)
    mockShouldUseWorkspaceBilling.value = false
  })

  it('shows the subscription settings panel after a successful purchase', async () => {
    mockPurchaseCreditsDirect.mockResolvedValue(undefined)

    renderDialog()
    await clickBuyCredits()

    expect(mockPurchaseCreditsDirect).toHaveBeenCalledWith(50)
    expect(mockCloseDialog).toHaveBeenCalled()
    expect(mockShowSettings).toHaveBeenCalledWith('subscription')
  })

  it('shows the credits settings panel when subscriptions are disabled', async () => {
    mockIsSubscriptionEnabled.mockReturnValue(false)
    mockPurchaseCreditsDirect.mockResolvedValue(undefined)

    renderDialog()
    await clickBuyCredits()

    expect(mockShowSettings).toHaveBeenCalledWith('credits')
  })

  it('shows the workspace settings panel when workspace billing is active', async () => {
    mockShouldUseWorkspaceBilling.value = true
    mockPurchaseCreditsDirect.mockResolvedValue(undefined)

    renderDialog()
    await clickBuyCredits()

    expect(mockShowSettings).toHaveBeenCalledWith('workspace')
  })

  it('tracks the failure and surfaces a toast when the purchase rejects', async () => {
    mockPurchaseCreditsDirect.mockRejectedValue(
      new Error('declined for person@example.com')
    )

    renderDialog()
    await clickBuyCredits()

    expect(mockTrackBillingEvent).toHaveBeenCalledWith({
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
    expect(mockShowSettings).not.toHaveBeenCalled()
  })

  it('uses the same bounded category when the rejection is not an Error', async () => {
    mockPurchaseCreditsDirect.mockRejectedValue('boom')

    renderDialog()
    await clickBuyCredits()

    expect(mockTrackBillingEvent).toHaveBeenCalledWith({
      operation: 'topup',
      stage: 'failed',
      outcome: 'failure',
      failure_category: 'unknown'
    })
  })
})
