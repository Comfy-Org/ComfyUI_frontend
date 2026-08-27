import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { WorkspaceApiError } from '@/platform/workspace/api/workspaceApi'
import type { CreateTopupResponse } from '@/platform/workspace/api/workspaceApi'

import TopUpCreditsDialogContentWorkspace from './TopUpCreditsDialogContentWorkspace.vue'

const mockFetchBalance = vi.fn()
const mockFetchStatus = vi.fn()
const mockManageSubscription = vi.fn<() => Promise<void>>()
const mockReportError = vi.hoisted(() => vi.fn())

vi.mock('@/platform/telemetry/reportError', () => ({
  reportError: mockReportError
}))
const mockTopup =
  vi.fn<(amountCents: number) => Promise<CreateTopupResponse | void>>()
const mockStartOperation = vi.fn()
const mockRetryPaymentAuthentication = vi.fn()
const mockShowSettings = vi.fn()
const mockToastAdd = vi.fn()
const mockCloseDialog = vi.fn()
const mockTrackTopUpPurchase = vi.fn()
const mockTrackBillingEvent = vi.fn()
const mockCanTopUp = vi.hoisted(() => ({
  ref: undefined as { value: boolean } | undefined
}))
const mockDistributionTypes = vi.hoisted(() => ({ isCloud: true }))

vi.mock('@/platform/distribution/types', () => mockDistributionTypes)

const mockHasSavedPaymentMethod = vi.hoisted(() => ({
  ref: undefined as { value: boolean | null } | undefined
}))

vi.mock(
  '@/platform/workspace/composables/useHasSavedPaymentMethod',
  async () => {
    const { ref } = await import('vue')
    mockHasSavedPaymentMethod.ref = ref<boolean | null>(null)
    return {
      useHasSavedPaymentMethod: () => ({
        hasSavedPaymentMethod: mockHasSavedPaymentMethod.ref
      })
    }
  }
)

interface MockTopupOperation {
  opId: string
  status: 'pending' | 'reconciliation_needed'
  actionUrl: string | null
  authenticationState?: string
  errorMessage?: string | null
  canRetryAuthentication?: boolean
  isAuthenticating?: boolean
}

const mockBillingOperationState = vi.hoisted(() => ({
  isAddingCredits: undefined as { value: boolean } | undefined,
  topupActionOperation: undefined as
    | { value: MockTopupOperation | undefined }
    | undefined
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    fetchBalance: mockFetchBalance,
    fetchStatus: mockFetchStatus,
    manageSubscription: mockManageSubscription,
    topup: (amountCents: number) => mockTopup(amountCents)
  })
}))

vi.mock('@/platform/workspace/stores/billingOperationStore', async () => {
  const { ref } = await import('vue')
  mockBillingOperationState.isAddingCredits = ref(false)
  mockBillingOperationState.topupActionOperation = ref(undefined)
  return {
    useBillingOperationStore: () => ({
      hasPendingOperations: true,
      get isAddingCredits() {
        return mockBillingOperationState.isAddingCredits?.value ?? false
      },
      get topupActionOperation() {
        return mockBillingOperationState.topupActionOperation?.value
      },
      startOperation: mockStartOperation,
      retryPaymentAuthentication: mockRetryPaymentAuthentication
    })
  }
})

vi.mock('@/platform/workspace/composables/useBillingCapabilities', async () => {
  const { ref } = await import('vue')
  mockCanTopUp.ref = ref(true)
  return {
    useBillingCapabilities: () => ({ canTopUp: mockCanTopUp.ref })
  }
})

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

const mockClearPendingTopup = vi.hoisted(() => vi.fn())
vi.mock('@/composables/billing/usePendingTopup', () => ({
  usePendingTopup: () => ({ clearPendingTopup: mockClearPendingTopup })
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
  messages: { en: enMessages }
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

function setCanTopUp(canTopUp: boolean) {
  if (!mockCanTopUp.ref) throw new Error('Capability mock not initialized')
  mockCanTopUp.ref.value = canTopUp
}

function setIsAddingCredits(isAddingCredits: boolean) {
  if (!mockBillingOperationState.isAddingCredits) {
    throw new Error('Billing operation mock not initialized')
  }
  mockBillingOperationState.isAddingCredits.value = isAddingCredits
}

function setTopupActionOperation(operation: MockTopupOperation | undefined) {
  if (!mockBillingOperationState.topupActionOperation) {
    throw new Error('Billing operation mock not initialized')
  }
  mockBillingOperationState.topupActionOperation.value = operation
}

function setHasSavedPaymentMethod(value: boolean | null) {
  if (!mockHasSavedPaymentMethod.ref) {
    throw new Error('Payment method mock not initialized')
  }
  mockHasSavedPaymentMethod.ref.value = value
}

async function clickAddCredits() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Add credits' }))
}

describe('TopUpCreditsDialogContentWorkspace', () => {
  beforeEach(() => {
    mockDistributionTypes.isCloud = true
    setCanTopUp(true)
    setIsAddingCredits(false)
    setTopupActionOperation(undefined)
    mockFetchBalance.mockResolvedValue(undefined)
    mockFetchStatus.mockResolvedValue(undefined)
    setHasSavedPaymentMethod(true)
    mockStartOperation.mockImplementation(() => {
      setIsAddingCredits(true)
      return new Promise(() => {})
    })
  })

  it('fires a started event before the purchase resolves', async () => {
    mockTopup.mockResolvedValue(topupResponse('pending'))

    renderDialog()
    await clickAddCredits()
    await userEvent.click(screen.getByRole('button', { name: 'Pay $50.00' }))

    await waitFor(() =>
      expect(mockTrackBillingEvent).toHaveBeenCalledWith({
        operation: 'topup',
        stage: 'started',
        outcome: 'pending'
      })
    )
    expect(mockTrackBillingEvent).toHaveBeenCalledWith({
      operation: 'operation',
      stage: 'started',
      outcome: 'pending',
      operation_type: 'topup'
    })
  })

  it('reports failure telemetry when topup resolves with no response', async () => {
    mockTopup.mockResolvedValue(undefined)

    renderDialog()
    await clickAddCredits()
    await userEvent.click(screen.getByRole('button', { name: 'Pay $50.00' }))

    await waitFor(() =>
      expect(mockTrackBillingEvent).toHaveBeenCalledWith({
        operation: 'topup',
        stage: 'failed',
        outcome: 'failure',
        failure_category: 'unknown',
        duration_ms: expect.any(Number)
      })
    )
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

  it('shows the saved-card note when a payment method is on file', async () => {
    renderDialog()

    await clickAddCredits()

    expect(
      await screen.findByText(
        'Your saved payment method is charged immediately.'
      )
    ).toBeInTheDocument()
  })

  it('asks for payment details when no payment method is saved', async () => {
    setHasSavedPaymentMethod(false)

    renderDialog()
    await clickAddCredits()

    expect(
      await screen.findByText(
        "You'll be asked to add a payment method to complete this purchase."
      )
    ).toBeInTheDocument()
  })

  it('opens the billing portal from the no-payment-method note', async () => {
    setHasSavedPaymentMethod(false)
    mockManageSubscription.mockResolvedValue(undefined)

    renderDialog()
    await clickAddCredits()

    await userEvent.click(
      await screen.findByRole('button', { name: 'Manage billing' })
    )

    expect(mockManageSubscription).toHaveBeenCalledTimes(1)
  })

  it('reports and surfaces a billing-portal opening failure', async () => {
    setHasSavedPaymentMethod(false)
    const failure = new Error('portal down')
    mockManageSubscription.mockRejectedValue(failure)

    renderDialog()
    await clickAddCredits()

    await userEvent.click(
      await screen.findByRole('button', { name: 'Manage billing' })
    )

    await waitFor(() =>
      expect(mockReportError).toHaveBeenCalledWith(failure, {
        errorType: 'billing_portal_open_failure'
      })
    )
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: 'Failed to open the billing portal. Please try again.'
      })
    )
  })

  it('explains how to add a payment method when the purchase is refused', async () => {
    setHasSavedPaymentMethod(false)
    mockTopup.mockRejectedValue(
      new WorkspaceApiError(
        'No default payment method is selected.',
        400,
        'NO_PAYMENT_METHOD'
      )
    )

    renderDialog()
    await clickAddCredits()
    await userEvent.click(screen.getByRole('button', { name: 'Pay $50.00' }))

    await waitFor(() =>
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          detail:
            'No payment method is saved for this workspace. Add one via Settings → Plan & Credits → Manage billing, then retry the top-up.'
        })
      )
    )
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
    setTopupActionOperation({
      opId: 'op-action',
      status: 'pending',
      actionUrl
    })

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
    setIsAddingCredits(true)
    setTopupActionOperation({
      opId: 'op-loading',
      status: 'pending',
      actionUrl: null
    })

    renderDialog()

    expect(screen.getByText('Verify your payment')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Complete verification' })
    ).toBeDisabled()
    expect(screen.queryByText('Select amount')).not.toBeInTheDocument()
  })

  it('returns to amount selection when a reopened operation ends', async () => {
    setIsAddingCredits(true)
    setTopupActionOperation({
      opId: 'op-loading',
      status: 'pending',
      actionUrl: null
    })

    renderDialog()
    expect(screen.getByText('Verify your payment')).toBeInTheDocument()

    setIsAddingCredits(false)
    setTopupActionOperation(undefined)
    await nextTick()

    expect(screen.getByText('Select amount')).toBeInTheDocument()
    expect(screen.queryByText('Verify your payment')).not.toBeInTheDocument()
  })

  it('hides topup verification after permission is revoked', () => {
    setCanTopUp(false)
    setTopupActionOperation({
      opId: 'op-action',
      status: 'pending',
      actionUrl: 'https://verify.example/sensitive-token'
    })

    renderDialog()

    expect(
      screen.queryByRole('button', { name: 'Complete verification' })
    ).not.toBeInTheDocument()
  })

  it('retries failed payment authentication', async () => {
    renderDialog()

    setIsAddingCredits(true)
    setTopupActionOperation({
      opId: 'op-retry',
      status: 'pending',
      actionUrl: null,
      authenticationState: 'failed_retryable',
      errorMessage: 'Your bank rejected the verification.',
      canRetryAuthentication: true
    })
    await nextTick()

    expect(
      screen.getByText('Your bank rejected the verification.')
    ).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', { name: 'Retry verification' })
    )
    expect(mockRetryPaymentAuthentication).toHaveBeenCalledWith('op-retry')
  })

  it('keeps a top-up locked when reconciliation needs support', () => {
    setTopupActionOperation({
      opId: 'op-reconcile',
      status: 'reconciliation_needed',
      actionUrl: null
    })

    renderDialog()

    expect(
      screen.getByText(/Contact support and include this operation ID/)
    ).toBeInTheDocument()
    expect(screen.getByText('op-reconcile')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Add credits' })
    ).not.toBeInTheDocument()
  })

  it('locks pending payment actions and prevents duplicate top-ups', async () => {
    mockTopup.mockResolvedValue(topupResponse('pending'))

    renderDialog()
    await clickAddCredits()
    const payButton = screen.getByRole('button', { name: 'Pay $50.00' })
    await userEvent.click(payButton)
    await nextTick()

    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled()
    expect(payButton).toBeDisabled()
    expect(mockStartOperation).toHaveBeenCalledWith('op-1', 'topup', {
      attemptStartedAt: expect.any(Number),
      autoHandleRequiresAction: true
    })

    payButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(mockTopup).toHaveBeenCalledOnce()
  })

  it('unlocks payment and reports an operation start failure', async () => {
    const error = new Error('Operation unavailable')
    mockTopup.mockResolvedValue(topupResponse('pending'))
    mockStartOperation.mockRejectedValue(error)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    renderDialog()
    await clickAddCredits()
    await userEvent.click(screen.getByRole('button', { name: 'Pay $50.00' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Pay $50.00' })).toBeEnabled()
    )
    expect(mockToastAdd).toHaveBeenCalledWith({
      severity: 'error',
      summary: 'Purchase Failed',
      detail: 'Failed to purchase credits: An unknown error occurred'
    })
    expect(mockTrackBillingEvent).toHaveBeenCalledWith({
      operation: 'topup',
      stage: 'failed',
      outcome: 'failure',
      billing_op_id: 'op-1',
      failure_category: 'unknown',
      duration_ms: expect.any(Number)
    })
    expect(consoleError).toHaveBeenCalledWith('Purchase failed')
    consoleError.mockRestore()
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
      billing_op_id: 'op-1',
      duration_ms: expect.any(Number)
    })
    expect(mockTrackBillingEvent).toHaveBeenCalledWith({
      operation: 'operation',
      stage: 'succeeded',
      outcome: 'success',
      operation_type: 'topup',
      billing_op_id: 'op-1',
      duration_ms: expect.any(Number)
    })
    expect(mockClearPendingTopup).not.toHaveBeenCalled()
  })

  it('clears the pending top-up marker when the user closes the dialog', async () => {
    renderDialog()
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(mockClearPendingTopup).toHaveBeenCalled()
    expect(mockCloseDialog).toHaveBeenCalled()
  })

  it('opens Credits settings after a completed local top-up', async () => {
    mockDistributionTypes.isCloud = false
    mockTopup.mockResolvedValue(topupResponse('completed'))

    renderDialog()
    await clickAddCredits()
    await userEvent.click(screen.getByRole('button', { name: 'Pay $50.00' }))

    expect(mockShowSettings).toHaveBeenCalledWith('credits')
  })

  it('keeps completed top-up telemetry successful when refresh fails', async () => {
    mockTopup.mockResolvedValue(topupResponse('completed'))
    mockFetchBalance.mockRejectedValueOnce(new Error('balance unavailable'))
    mockFetchStatus.mockRejectedValueOnce(new Error('status unavailable'))

    renderDialog()
    await clickAddCredits()
    await userEvent.click(screen.getByRole('button', { name: 'Pay $50.00' }))

    expect(mockTrackBillingEvent).toHaveBeenCalledTimes(4)
    expect(mockTrackBillingEvent).toHaveBeenCalledWith({
      operation: 'topup',
      stage: 'succeeded',
      outcome: 'success',
      billing_op_id: 'op-1',
      duration_ms: expect.any(Number)
    })
    expect(mockShowSettings).toHaveBeenCalledWith('workspace')
  })

  it('does not refresh balance or status for a pending top-up', async () => {
    mockTopup.mockResolvedValue(topupResponse('pending'))

    renderDialog()
    await clickAddCredits()
    await userEvent.click(screen.getByRole('button', { name: 'Pay $50.00' }))

    expect(mockStartOperation).toHaveBeenCalledWith('op-1', 'topup', {
      attemptStartedAt: expect.any(Number),
      autoHandleRequiresAction: true
    })
    expect(mockFetchBalance).not.toHaveBeenCalled()
    expect(mockFetchStatus).not.toHaveBeenCalled()
    expect(mockTrackBillingEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'succeeded' })
    )
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
      failure_category: 'provider_decline',
      duration_ms: expect.any(Number)
    })
    expect(mockTrackBillingEvent).toHaveBeenCalledWith({
      operation: 'operation',
      stage: 'failed',
      outcome: 'failure',
      operation_type: 'topup',
      billing_op_id: 'op-1',
      failure_category: 'provider_decline',
      duration_ms: expect.any(Number)
    })
  })

  it('categorizes a thrown topup error via the shared classifier', async () => {
    const workspaceApiError = new WorkspaceApiError('upstream rejected', 500)
    mockTopup.mockRejectedValue(workspaceApiError)

    renderDialog()
    await clickAddCredits()
    await userEvent.click(screen.getByRole('button', { name: 'Pay $50.00' }))

    await waitFor(() =>
      expect(mockTrackBillingEvent).toHaveBeenCalledWith({
        operation: 'topup',
        stage: 'failed',
        outcome: 'failure',
        failure_category: 'api_rejected',
        duration_ms: expect.any(Number)
      })
    )
  })

  it('does not top up after the server capability is revoked', async () => {
    renderDialog()
    await clickAddCredits()
    setCanTopUp(false)
    await nextTick()

    expect(screen.getByRole('button', { name: 'Pay $50.00' })).toBeDisabled()

    expect(mockTopup).not.toHaveBeenCalled()
    expect(mockTrackTopUpPurchase).not.toHaveBeenCalled()
    expect(mockToastAdd).not.toHaveBeenCalled()
    expect(mockCloseDialog).not.toHaveBeenCalled()
  })
})
