import { useBillingOperationStore } from '@/platform/workspace/stores/billingOperationStore'
import { useDialogStore } from '@/stores/dialogStore'
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { WorkspaceApiError } from '@/platform/workspace/api/workspaceApi'
import type { CreateTopupResponse } from '@/platform/workspace/api/workspaceApi'
import { billingOperation } from '@/platform/workspace/composables/billingOperationTestUtils'
import type { BillingOperation } from '@/platform/workspace/composables/billingOperationTestUtils'

import TopUpCreditsDialogContentWorkspace from './TopUpCreditsDialogContentWorkspace.vue'

const mockFetchBalance = vi.fn()
const mockFetchStatus = vi.fn()
const mockManageSubscription = vi.fn<() => Promise<void>>()
const mockReportError = vi.hoisted(() => vi.fn())

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: mockReportError
}))
const mockTopup =
  vi.fn<(amountCents: number) => Promise<CreateTopupResponse | void>>()

const mockShowSettings = vi.fn()
const mockToastAdd = vi.fn()

const mockTrackTopUpPurchase = vi.fn()
const mockTrackBillingEvent = vi.fn()
const mockCanTopUp = vi.hoisted(() => ({
  ref: undefined as { value: boolean } | undefined
}))
const mockDistributionTypes = vi.hoisted(() => ({ isCloud: true }))

vi.mock(import('@/platform/distribution/types'), () => mockDistributionTypes)

const mockHasSavedPaymentMethod = vi.hoisted(() => ({
  ref: undefined as { value: boolean | null } | undefined
}))

vi.mock<unknown>(
  import('@/platform/workspace/composables/useHasSavedPaymentMethod'),
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

vi.mock<unknown>(import('@/composables/billing/useBillingContext'), () => ({
  useBillingContext: () => ({
    fetchBalance: mockFetchBalance,
    fetchStatus: mockFetchStatus,
    manageSubscription: mockManageSubscription,
    topup: (amountCents: number) => mockTopup(amountCents)
  })
}))

vi.mock<unknown>(
  import('@/platform/workspace/composables/useBillingCapabilities'),
  async () => {
    const { ref } = await import('vue')
    mockCanTopUp.ref = ref(true)
    return {
      useBillingCapabilities: () => ({ canTopUp: mockCanTopUp.ref })
    }
  }
)

vi.mock<unknown>(
  import('@/platform/settings/composables/useSettingsDialog'),
  () => ({
    useSettingsDialog: () => ({ show: mockShowSettings })
  })
)

vi.mock<unknown>(import('@/platform/telemetry'), () => ({
  useTelemetry: () => ({
    trackApiCreditTopupButtonPurchaseClicked: mockTrackTopUpPurchase,
    trackBillingEvent: mockTrackBillingEvent
  })
}))

const mockClearPendingTopup = vi.hoisted(() => vi.fn())
vi.mock<unknown>(import('@/composables/billing/usePendingTopup'), () => ({
  usePendingTopup: () => ({ clearPendingTopup: mockClearPendingTopup })
}))

vi.mock<unknown>(import('@/composables/useExternalLink'), () => ({
  useExternalLink: () => ({
    buildDocsUrl: () => 'https://docs.comfy.org',
    docsPaths: { partnerNodesPricing: '' }
  })
}))

vi.mock<unknown>(
  import('primevue/usetoast'), // eslint-disable-line primevue-removal/no-imports
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
  Object.assign(useBillingOperationStore(), { isAddingCredits })
}

function setTopupActionOperation(
  operation: Partial<BillingOperation> | undefined
) {
  Object.assign(useBillingOperationStore(), {
    topupActionOperation: operation
      ? billingOperation({ type: 'topup', ...operation })
      : undefined
  })
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

beforeEach(() => {
  vi.mocked(useDialogStore().closeDialog).mockImplementation(() => {})
})

beforeEach(() => {
  Object.assign(useBillingOperationStore(), { hasPendingOperations: true })
  vi.mocked(useBillingOperationStore().startOperation).mockResolvedValue(
    billingOperation({ type: 'topup' })
  )
  vi.mocked(
    useBillingOperationStore().retryPaymentAuthentication
  ).mockResolvedValue(false)
  vi.mocked(useBillingOperationStore().dismissOperation).mockImplementation(
    (opId) => {
      const store = useBillingOperationStore()
      if (store.topupActionOperation?.opId === opId) {
        Object.assign(store, { topupActionOperation: undefined })
      }
      Object.assign(store, { isAddingCredits: false })
    }
  )
})

describe('TopUpCreditsDialogContentWorkspace', () => {
  beforeEach(() => {
    mockDistributionTypes.isCloud = true
    setCanTopUp(true)
    setIsAddingCredits(false)
    setTopupActionOperation(undefined)
    mockFetchBalance.mockResolvedValue(undefined)
    mockFetchStatus.mockResolvedValue(undefined)
    setHasSavedPaymentMethod(true)
    vi.mocked(useBillingOperationStore().startOperation).mockImplementation(
      () => {
        setIsAddingCredits(true)
        return new Promise(() => {})
      }
    )
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

  it('enters verification once permission resolves after an operation already exists', async () => {
    setCanTopUp(false)
    setTopupActionOperation({
      opId: 'op-action',
      status: 'pending',
      actionUrl: 'https://verify.example/sensitive-token'
    })

    renderDialog()
    expect(screen.getByText('Select amount')).toBeInTheDocument()

    setCanTopUp(true)
    await nextTick()

    expect(screen.getByText('Verify your payment')).toBeInTheDocument()
    expect(screen.queryByText('Select amount')).not.toBeInTheDocument()
  })

  it('resumes a live challenge in page', async () => {
    renderDialog()

    setIsAddingCredits(true)
    setTopupActionOperation({
      opId: 'op-resume',
      status: 'pending',
      actionUrl: null,
      authenticationState: 'requires_action',
      canRetryAuthentication: true
    })
    await nextTick()

    await userEvent.click(
      screen.getByRole('button', { name: 'Complete verification' })
    )
    expect(
      useBillingOperationStore().retryPaymentAuthentication
    ).toHaveBeenCalledWith('op-resume')
  })

  it('reports a failed challenge without offering to resume it', async () => {
    renderDialog()

    setTopupActionOperation({
      opId: 'op-failed',
      status: 'pending',
      actionUrl: null,
      authenticationState: 'failed_retryable',
      errorMessage: 'Your bank rejected the verification.'
    })
    await nextTick()

    expect(
      screen.getByText('Your bank rejected the verification.')
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Complete verification' })
    ).not.toBeInTheDocument()
    expect(
      useBillingOperationStore().retryPaymentAuthentication
    ).not.toHaveBeenCalled()
  })

  it('lets the customer start over after a failed challenge', async () => {
    mockTopup.mockResolvedValue(topupResponse('pending'))

    renderDialog()
    await clickAddCredits()
    await userEvent.click(screen.getByRole('button', { name: 'Pay $50.00' }))
    await nextTick()

    setTopupActionOperation({
      opId: 'op-1',
      status: 'pending',
      actionUrl: null,
      authenticationState: 'failed_retryable',
      errorMessage: 'Your bank rejected the verification.'
    })
    await nextTick()

    await userEvent.click(screen.getByRole('button', { name: 'Start over' }))
    await nextTick()

    expect(useBillingOperationStore().dismissOperation).toHaveBeenCalledWith(
      'op-1'
    )
    expect(
      screen.queryByText('Your bank rejected the verification.')
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add credits' })).toBeEnabled()
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
    expect(useBillingOperationStore().startOperation).toHaveBeenCalledWith(
      'op-1',
      'topup',
      {
        attemptStartedAt: expect.any(Number),
        autoHandleRequiresAction: true
      }
    )

    payButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(mockTopup).toHaveBeenCalledOnce()
  })

  it('unlocks payment and reports an operation start failure', async () => {
    const error = new Error('Operation unavailable')
    mockTopup.mockResolvedValue(topupResponse('pending'))
    vi.mocked(useBillingOperationStore().startOperation).mockRejectedValue(
      error
    )
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
    expect(useDialogStore().closeDialog).toHaveBeenCalled()
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

    expect(useBillingOperationStore().startOperation).toHaveBeenCalledWith(
      'op-1',
      'topup',
      {
        attemptStartedAt: expect.any(Number),
        autoHandleRequiresAction: true
      }
    )
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
    expect(useDialogStore().closeDialog).not.toHaveBeenCalled()
  })
})
