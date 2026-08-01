import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
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
const mockManageSubscription = vi.fn()
const mockBalance = { value: null as { amountMicros: number } | null }
const mockCanTopUp = vi.hoisted(() => ({ value: true }))
const mockShouldUseWorkspaceBilling = vi.hoisted(() => ({ value: true }))
const mockTopupActionOperation = ref<{ actionUrl: string } | undefined>(
  undefined
)
const mockIsAddingCredits = ref(false)

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    balance: mockBalance,
    fetchBalance: mockFetchBalance,
    fetchStatus: mockFetchStatus,
    topup: (amountCents: number) => mockTopup(amountCents),
    manageSubscription: mockManageSubscription
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
      g: { close: 'Close', back: 'Back' },
      subscription: {
        addCredits: 'Add credits',
        billingAndInvoices: 'Billing & invoices',
        preview: {
          totalDueToday: 'Total due today',
          completeVerification: 'Complete verification'
        },
        success: {
          allSet: "You're all set",
          receiptEmailed: 'A receipt has been emailed to you.'
        }
      },
      credits: {
        topUp: {
          addMoreCredits: 'Add additional credits',
          addMoreCreditsToRun: 'Add additional credits to run',
          selectAmount: 'Select an amount',
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
          confirmTitle: 'Confirm',
          confirmSubtitle:
            'Credits are added to this workspace as soon as payment completes.',
          chargedImmediatelyNote: 'Your saved card is charged immediately.',
          viewChargeNote:
            'View this charge anytime in {billing} in your workspace settings.',
          payAmount: 'Pay {amount}',
          changePaymentMethod: 'Change',
          addNewPaymentMethod: 'Add new payment method',
          verifyTitle: 'Verify your payment',
          verifyBody:
            'Your bank requires additional verification to complete this payment.',
          previousBalance: 'Previous balance',
          addedLabel: 'Added',
          newBalance: 'New balance',
          declinedTitle: 'Payment declined',
          declinedDescription:
            "Your card couldn't be charged. Try another card, or contact your bank if this looks wrong.",
          stripeReasoning: 'Stripe reasoning:',
          updatePaymentMethod: 'Update payment method'
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

const VISA = { id: 'pm_1', type: 'card', brand: 'Visa', last4: '4242' } as const
const MASTERCARD = {
  id: 'pm_2',
  type: 'card',
  brand: 'Mastercard',
  last4: '5100'
} as const

function renderDialog(props: Record<string, unknown> = {}) {
  return render(TopUpCreditsDialogContentWorkspace, {
    props,
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
    mockBalance.value = null
    mockTopupActionOperation.value = undefined
    mockIsAddingCredits.value = false
    mockCanTopUp.value = true
    mockShouldUseWorkspaceBilling.value = true
    mockFetchBalance.mockResolvedValue(undefined)
    mockFetchStatus.mockResolvedValue(undefined)
    mockStartOperation.mockReturnValue(new Promise(() => {}))
  })

  it('allows a top-up while an unrelated billing operation is pending', () => {
    renderDialog()

    expect(screen.getByRole('button', { name: 'Add credits' })).toBeEnabled()
  })

  it('refreshes both balance and status after a completed top-up', async () => {
    mockTopup.mockResolvedValue(topupResponse('completed'))

    renderDialog()
    await clickAddCredits()

    expect(mockFetchBalance).toHaveBeenCalledOnce()
    expect(mockFetchStatus).toHaveBeenCalledOnce()
    expect(screen.getByText("You're all set")).toBeInTheDocument()
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

    expect(mockTrackBillingEvent).toHaveBeenCalledTimes(1)
    expect(mockTrackBillingEvent).toHaveBeenCalledWith({
      operation: 'topup',
      stage: 'succeeded',
      outcome: 'success',
      billing_op_id: 'op-1'
    })
    expect(screen.getByText("You're all set")).toBeInTheDocument()
  })

  it('does not refresh balance or status for a pending top-up', async () => {
    mockTopup.mockResolvedValue(topupResponse('pending'))

    renderDialog()
    await clickAddCredits()

    expect(mockStartOperation).toHaveBeenCalledWith('op-1', 'topup')
    expect(mockFetchBalance).not.toHaveBeenCalled()
    expect(mockFetchStatus).not.toHaveBeenCalled()
    expect(mockTrackBillingEvent).not.toHaveBeenCalled()
  })

  it('lands on the success step when a polled top-up succeeds', async () => {
    mockTopup.mockResolvedValue(topupResponse('pending'))
    mockStartOperation.mockResolvedValue({
      status: 'succeeded',
      errorMessage: null
    })

    renderDialog({ savedMethods: [VISA] })
    await clickAddCredits()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Pay $50.00' }))

    expect(screen.getByText("You're all set")).toBeInTheDocument()
    expect(mockFetchBalance).toHaveBeenCalledOnce()
  })

  it('lands on the declined step when a polled top-up fails', async () => {
    mockTopup.mockResolvedValue(topupResponse('pending'))
    mockStartOperation.mockResolvedValue({
      status: 'failed',
      errorMessage: 'Your card has insufficient funds.'
    })

    renderDialog({ savedMethods: [VISA] })
    await clickAddCredits()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Pay $50.00' }))

    expect(screen.getByText('Payment declined')).toBeInTheDocument()
    expect(
      screen.getByText('Your card has insufficient funds.')
    ).toBeInTheDocument()
  })

  it('does not refresh balance or status for a failed top-up', async () => {
    mockTopup.mockResolvedValue(topupResponse('failed'))

    renderDialog()
    await clickAddCredits()

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

    expect(mockTopup).not.toHaveBeenCalled()
    expect(mockTrackTopUpPurchase).not.toHaveBeenCalled()
    expect(mockToastAdd).not.toHaveBeenCalled()
    expect(mockCloseDialog).not.toHaveBeenCalled()
  })

  it('routes back to the verifying step while a charge awaits verification', async () => {
    mockTopup.mockResolvedValue(topupResponse('pending'))

    renderDialog({ savedMethods: [VISA] })
    await clickAddCredits()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Pay $50.00' }))
    mockTopupActionOperation.value = {
      actionUrl: 'https://verify.example/sensitive-token'
    }
    await nextTick()

    await user.click(screen.getByRole('button', { name: 'Back' }))

    expect(screen.getByText('Verify your payment')).toBeInTheDocument()
    expect(screen.queryByText('Select an amount')).not.toBeInTheDocument()
  })

  it('routes back to verifying even before the bank link arrives', async () => {
    mockTopup.mockResolvedValue(topupResponse('pending'))

    renderDialog({ savedMethods: [VISA] })
    await clickAddCredits()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Pay $50.00' }))
    mockIsAddingCredits.value = true
    await nextTick()

    await user.click(screen.getByRole('button', { name: 'Back' }))

    expect(screen.getByText('Verify your payment')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Complete verification' })
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Select an amount')).not.toBeInTheDocument()
  })

  it('jumps from amount to verifying when the bank link arrives', async () => {
    renderDialog()

    mockTopupActionOperation.value = {
      actionUrl: 'https://verify.example/sensitive-token'
    }
    await nextTick()

    expect(screen.getByText('Verify your payment')).toBeInTheDocument()
    expect(screen.queryByText('Select an amount')).not.toBeInTheDocument()
  })

  it('reopens onto the verifying step and opens verification without exposing its URL', async () => {
    const actionUrl = 'https://verify.example/sensitive-token'
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window)
    mockTopupActionOperation.value = { actionUrl }

    const { container } = renderDialog()

    expect(screen.getByText('Verify your payment')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Add credits' })
    ).not.toBeInTheDocument()
    expect(container.innerHTML).not.toContain(actionUrl)
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Complete verification' }))
    expect(open).toHaveBeenCalledWith(
      actionUrl,
      '_blank',
      'noopener,noreferrer'
    )
    open.mockRestore()
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

  it('shows the confirm step instead of charging when a saved method exists', async () => {
    renderDialog({ savedMethods: [VISA] })

    await clickAddCredits()

    expect(mockTopup).not.toHaveBeenCalled()
    expect(screen.getByText('Confirm')).toBeInTheDocument()
    expect(screen.getByText('Visa')).toBeInTheDocument()
    expect(screen.getByText('·· 4242')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Pay $50.00' })
    ).toBeInTheDocument()
  })

  it('charges only after the confirm step pay button is clicked', async () => {
    mockTopup.mockResolvedValue(topupResponse('completed'))

    renderDialog({ savedMethods: [VISA] })
    await clickAddCredits()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Pay $50.00' }))

    expect(mockTopup).toHaveBeenCalledWith(5000)
  })

  it('shows the success step with the balance summary after a confirmed charge', async () => {
    mockTopup.mockResolvedValue(topupResponse('completed'))
    mockBalance.value = { amountMicros: 46_450 * 1_000_000 }

    renderDialog({ savedMethods: [VISA] })
    await clickAddCredits()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Pay $50.00' }))

    expect(screen.getByText("You're all set")).toBeInTheDocument()
    expect(screen.getByText('46,450')).toBeInTheDocument()
    expect(screen.getByText('+50')).toBeInTheDocument()
    expect(screen.getByText('46,500')).toBeInTheDocument()
    expect(mockCloseDialog).not.toHaveBeenCalled()

    const closeCta = screen
      .getAllByRole('button', { name: 'Close' })
      .find((button) => button.textContent?.trim() === 'Close')
    expect(closeCta).toBeDefined()
    await user.click(closeCta!)
    expect(mockCloseDialog).toHaveBeenCalledOnce()
    expect(mockShowSettings).not.toHaveBeenCalled()
  })

  it('routes the success Billing & invoices link to workspace settings', async () => {
    mockTopup.mockResolvedValue(topupResponse('completed'))

    renderDialog({ savedMethods: [VISA] })
    await clickAddCredits()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Pay $50.00' }))

    await user.click(screen.getByRole('button', { name: 'Billing & invoices' }))

    expect(mockCloseDialog).toHaveBeenCalledOnce()
    expect(mockShowSettings).toHaveBeenCalledWith('workspace')
  })

  it('shows the declined step with the failure reason after a rejected charge', async () => {
    mockTopup.mockRejectedValue(new Error('Insufficient funds'))

    renderDialog({ savedMethods: [VISA] })
    await clickAddCredits()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Pay $50.00' }))

    expect(screen.getByText('Payment declined')).toBeInTheDocument()
    expect(screen.getByText('Insufficient funds')).toBeInTheDocument()
    expect(mockToastAdd).not.toHaveBeenCalled()

    await user.click(
      screen.getByRole('button', { name: 'Update payment method' })
    )
    expect(mockManageSubscription).toHaveBeenCalledOnce()
  })

  it('shows a method picker instead of the Change row for multiple saved methods', async () => {
    renderDialog({ savedMethods: [VISA, MASTERCARD] })
    await clickAddCredits()

    expect(
      screen.queryByRole('button', { name: 'Change' })
    ).not.toBeInTheDocument()
    expect(screen.getByText('Visa ·· 4242')).toBeInTheDocument()
  })

  it('routes Change on the confirm step to the billing portal', async () => {
    renderDialog({ savedMethods: [VISA] })
    await clickAddCredits()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Change' }))

    expect(mockManageSubscription).toHaveBeenCalledOnce()
    expect(mockTopup).not.toHaveBeenCalled()
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
