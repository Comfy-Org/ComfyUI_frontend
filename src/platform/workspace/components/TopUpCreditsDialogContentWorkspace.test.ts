import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
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
const mockTrackBillingEvent = vi.fn()
const mockCanTopUp = vi.hoisted(() => ({ value: true }))
const mockShouldUseWorkspaceBilling = vi.hoisted(() => ({ value: true }))
const mockIsAddingCredits = vi.hoisted(() => ({ value: false }))
const mockTopupActionOperation = vi.hoisted(() => ({
  value: undefined as { actionUrl: string } | undefined
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    fetchBalance: mockFetchBalance,
    fetchStatus: mockFetchStatus,
    topup: (amountCents: number) => mockTopup(amountCents)
  })
}))

vi.mock('@/platform/workspace/stores/billingOperationStore', () => ({
  useBillingOperationStore: () => ({
    hasPendingOperations: true,
    get isAddingCredits() {
      return mockIsAddingCredits.value
    },
    get topupActionOperation() {
      return mockTopupActionOperation.value
    },
    startOperation: mockStartOperation
  })
}))

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({
    permissions: {
      __v_isRef: true,
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
      g: { back: 'Back', close: 'Close' },
      subscription: {
        addCredits: 'Add credits',
        preview: {
          completeVerification: 'Complete verification',
          totalDueToday: 'Total due today'
        }
      },
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
          insufficientWorkflowMessage: 'Insufficient credits',
          chargedImmediatelyNote: 'Your saved card is charged immediately.',
          confirmSubtitle:
            'Credits are added to this workspace as soon as payment completes.',
          confirmTitle: 'Confirm',
          payAmount: 'Pay {amount}',
          verifyBody:
            'Your bank requires additional verification to complete this payment.',
          verifyTitle: 'Verify your payment'
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
    mockIsAddingCredits.value = false
    mockTopupActionOperation.value = undefined
    mockFetchBalance.mockResolvedValue(undefined)
    mockFetchStatus.mockResolvedValue(undefined)
    mockStartOperation.mockImplementation(() => {
      mockIsAddingCredits.value = true
      return new Promise(() => {})
    })
  })

  it('allows a top-up while an unrelated billing operation is pending', () => {
    renderDialog()

    expect(screen.getByRole('button', { name: 'Add credits' })).toBeEnabled()
  })

  it('advances to confirmation without charging', async () => {
    renderDialog()

    await clickAddCredits()

    expect(screen.getByText('Confirm')).toBeInTheDocument()
    expect(screen.getByText('Total due today')).toBeInTheDocument()
    expect(screen.getByText('$50.00')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pay $50.00' })).toBeEnabled()
    expect(mockTopup).not.toHaveBeenCalled()
  })

  it('allows returning to amount selection before payment', async () => {
    renderDialog()
    await clickAddCredits()

    await userEvent.click(screen.getByRole('button', { name: 'Back' }))

    expect(screen.getByText('Select amount')).toBeInTheDocument()
  })

  it('reopens in verification without exposing the action URL', async () => {
    const actionUrl = 'https://verify.example/sensitive-token'
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window)
    mockTopupActionOperation.value = { actionUrl }

    const { container } = renderDialog()

    expect(screen.getByText('Verify your payment')).toBeInTheDocument()
    expect(screen.queryByText('Select amount')).not.toBeInTheDocument()
    expect(container.innerHTML).not.toContain(actionUrl)
    await userEvent.click(
      screen.getByRole('button', { name: 'Complete verification' })
    )
    expect(open).toHaveBeenCalledWith(
      actionUrl,
      '_blank',
      'noopener,noreferrer'
    )
    open.mockRestore()
  })

  it('reopens in verification while the action URL is loading', () => {
    mockIsAddingCredits.value = true

    renderDialog()

    expect(screen.getByText('Verify your payment')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Complete verification' })
    ).toBeDisabled()
    expect(screen.queryByText('Select amount')).not.toBeInTheDocument()
  })

  it('hides topup verification after permission is revoked', () => {
    mockCanTopUp.value = false
    mockTopupActionOperation.value = {
      actionUrl: 'https://verify.example/sensitive-token'
    }

    renderDialog()

    expect(
      screen.queryByRole('button', { name: 'Complete verification' })
    ).not.toBeInTheDocument()
  })

  it('locks back navigation after Pay while the top-up is pending', async () => {
    mockTopup.mockResolvedValue(topupResponse('pending'))

    renderDialog()
    await clickAddCredits()
    await userEvent.click(screen.getByRole('button', { name: 'Pay $50.00' }))
    await nextTick()

    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled()
    expect(mockStartOperation).toHaveBeenCalledWith('op-1', 'topup')
  })

  it('refreshes both balance and status after a completed top-up', async () => {
    mockTopup.mockResolvedValue(topupResponse('completed'))

    renderDialog()
    await clickAddCredits()
    await userEvent.click(screen.getByRole('button', { name: 'Pay $50.00' }))

    expect(mockFetchBalance).toHaveBeenCalledOnce()
    expect(mockFetchStatus).toHaveBeenCalledOnce()
    expect(mockShowSettings).toHaveBeenCalledWith('workspace')
    expect(mockTrackBillingEvent).toHaveBeenCalledWith({
      operation: 'topup',
      stage: 'succeeded',
      outcome: 'success',
      billing_op_id: 'op-1'
    })
  })

  it('keeps completed top-up telemetry successful when refresh fails', async () => {
    mockTopup.mockResolvedValue(topupResponse('completed'))
    mockFetchBalance.mockRejectedValueOnce(new Error('balance unavailable'))
    mockFetchStatus.mockRejectedValueOnce(new Error('status unavailable'))

    renderDialog()
    await clickAddCredits()
    await userEvent.click(screen.getByRole('button', { name: 'Pay $50.00' }))

    expect(mockTrackBillingEvent).toHaveBeenCalledTimes(1)
    expect(mockTrackBillingEvent).toHaveBeenCalledWith({
      operation: 'topup',
      stage: 'succeeded',
      outcome: 'success',
      billing_op_id: 'op-1'
    })
    expect(mockShowSettings).toHaveBeenCalledWith('workspace')
  })

  it('does not refresh balance or status for a pending top-up', async () => {
    mockTopup.mockResolvedValue(topupResponse('pending'))

    renderDialog()
    await clickAddCredits()
    await userEvent.click(screen.getByRole('button', { name: 'Pay $50.00' }))

    expect(mockStartOperation).toHaveBeenCalledWith('op-1', 'topup')
    expect(mockFetchBalance).not.toHaveBeenCalled()
    expect(mockFetchStatus).not.toHaveBeenCalled()
    expect(mockTrackBillingEvent).not.toHaveBeenCalled()
  })

  it('does not refresh balance or status for a failed top-up', async () => {
    mockTopup.mockResolvedValue(topupResponse('failed'))

    renderDialog()
    await clickAddCredits()
    await userEvent.click(screen.getByRole('button', { name: 'Pay $50.00' }))

    expect(mockFetchBalance).not.toHaveBeenCalled()
    expect(mockFetchStatus).not.toHaveBeenCalled()
    expect(mockTrackBillingEvent).toHaveBeenCalledWith({
      operation: 'topup',
      stage: 'failed',
      outcome: 'failure',
      billing_op_id: 'op-1',
      failure_category: 'unknown'
    })
  })

  it('does not top up after the workspace role loses permission', async () => {
    renderDialog()
    mockCanTopUp.value = false

    await clickAddCredits()
    await userEvent.click(screen.getByRole('button', { name: 'Pay $50.00' }))

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
    await userEvent.click(screen.getByRole('button', { name: 'Pay $50.00' }))

    expect(mockTopup).toHaveBeenCalledWith(5000)
    expect(mockFetchBalance).toHaveBeenCalledOnce()
    expect(mockFetchStatus).toHaveBeenCalledOnce()
  })
})
