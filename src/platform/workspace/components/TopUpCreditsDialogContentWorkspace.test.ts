import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { CreateTopupResponse } from '@/platform/workspace/api/workspaceApi'

import TopUpCreditsDialogContentWorkspace from './TopUpCreditsDialogContentWorkspace.vue'

const mockFetchBalance = vi.fn()
const mockFetchStatus = vi.fn()
const mockTopup = vi.fn<(amountCents: number) => Promise<CreateTopupResponse>>()
const mockStartOperation = vi.fn()
const mockShowSettings = vi.fn()
const mockToastAdd = vi.fn()
const mockCloseDialog = vi.fn()
const mockTrackTopUpPurchase = vi.fn()
const mockCanTopUp = vi.hoisted(() => ({ value: true }))
const mockShouldUseWorkspaceBilling = vi.hoisted(() => ({ value: true }))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    fetchBalance: mockFetchBalance,
    fetchStatus: mockFetchStatus,
    topup: (amountCents: number) => mockTopup(amountCents)
  })
}))

vi.mock('@/platform/workspace/stores/billingOperationStore', () => ({
  useBillingOperationStore: () => ({
    hasPendingOperations: false,
    startOperation: mockStartOperation
  })
}))

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({
    permissions: {
      get value() {
        return { canTopUp: mockCanTopUp.value }
      }
    }
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

vi.mock('@/platform/settings/composables/useSettingsDialog', () => ({
  useSettingsDialog: () => ({ show: mockShowSettings })
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({ closeDialog: mockCloseDialog })
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackApiCreditTopupButtonPurchaseClicked: mockTrackTopUpPurchase
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
      subscription: { addCredits: 'Add credits' },
      credits: {
        topUp: {
          addMoreCredits: 'Add more credits',
          addMoreCreditsToRun: 'Add more credits to run',
          selectAmount: 'Select amount',
          youPay: 'You pay',
          youGet: 'You get',
          purchaseSuccess: 'Credits added successfully!',
          purchaseError: 'Purchase Failed',
          purchaseErrorDetail: 'Failed to purchase credits: {error}',
          unknownError: 'An unknown error occurred',
          minRequired: 'Minimum required',
          maxAllowed: 'Maximum allowed',
          needMore: 'Need more?',
          contactUs: 'Contact us',
          viewPricing: 'View pricing',
          insufficientWorkflowMessage: 'Insufficient credits'
        }
      }
    }
  }
})

function topupResponse(
  status: CreateTopupResponse['status']
): CreateTopupResponse {
  return {
    billing_op_id: 'op-1',
    topup_id: 'topup-1',
    status,
    amount_cents: 5000
  }
}

function renderDialog() {
  return render(TopUpCreditsDialogContentWorkspace, {
    global: {
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

async function clickAddCredits() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Add credits' }))
}

describe('TopUpCreditsDialogContentWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanTopUp.value = true
    mockShouldUseWorkspaceBilling.value = true
    mockFetchBalance.mockResolvedValue(undefined)
    mockFetchStatus.mockResolvedValue(undefined)
  })

  it('refreshes both balance and status after a completed top-up', async () => {
    mockTopup.mockResolvedValue(topupResponse('completed'))

    renderDialog()
    await clickAddCredits()

    expect(mockFetchBalance).toHaveBeenCalledOnce()
    expect(mockFetchStatus).toHaveBeenCalledOnce()
    expect(mockShowSettings).toHaveBeenCalledWith('workspace')
  })

  it('does not refresh balance or status for a pending top-up', async () => {
    mockTopup.mockResolvedValue(topupResponse('pending'))

    renderDialog()
    await clickAddCredits()

    expect(mockStartOperation).toHaveBeenCalledWith('op-1', 'topup')
    expect(mockFetchBalance).not.toHaveBeenCalled()
    expect(mockFetchStatus).not.toHaveBeenCalled()
  })

  it('redirects to Checkout when the top-up needs customer payment', async () => {
    const assign = vi
      .spyOn(window.location, 'assign')
      .mockImplementation(() => undefined)
    mockTopup.mockResolvedValue({
      ...topupResponse('needs_payment_method'),
      payment_method_url: 'https://checkout.stripe.com/session'
    })

    renderDialog()
    await clickAddCredits()

    expect(assign).toHaveBeenCalledWith('https://checkout.stripe.com/session')
    expect(mockStartOperation).not.toHaveBeenCalled()
    expect(mockFetchBalance).not.toHaveBeenCalled()
  })

  it('does not refresh balance or status for a failed top-up', async () => {
    mockTopup.mockResolvedValue(topupResponse('failed'))

    renderDialog()
    await clickAddCredits()

    expect(mockFetchBalance).not.toHaveBeenCalled()
    expect(mockFetchStatus).not.toHaveBeenCalled()
  })

  it('does not top up after the workspace role loses permission', async () => {
    renderDialog()
    mockCanTopUp.value = false

    await clickAddCredits()

    expect(mockTopup).not.toHaveBeenCalled()
    expect(mockTrackTopUpPurchase).not.toHaveBeenCalled()
    expect(mockToastAdd).not.toHaveBeenCalled()
    expect(mockCloseDialog).not.toHaveBeenCalled()
  })

  it('keeps a mounted workspace dialog usable after routing switches to legacy billing', async () => {
    mockCanTopUp.value = false
    mockShouldUseWorkspaceBilling.value = false
    mockTopup.mockResolvedValue(topupResponse('completed'))

    renderDialog()
    await clickAddCredits()

    expect(mockTopup).toHaveBeenCalledWith(5000)
    expect(mockFetchBalance).toHaveBeenCalledOnce()
    expect(mockFetchStatus).toHaveBeenCalledOnce()
  })
})
