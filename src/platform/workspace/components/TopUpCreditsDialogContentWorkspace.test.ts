import { useBillingOperationStore } from '@/platform/workspace/stores/billingOperationStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import {
  clearCheckoutJourney,
  getActiveCheckoutJourney,
  resolveCheckoutJourney
} from '@/platform/workspace/utils/checkoutJourney'
import { useAuthStore } from '@/stores/authStore'
import { useDialogStore } from '@/stores/dialogStore'
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { useTelemetry } from '@/platform/telemetry'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { WorkspaceApiError } from '@/platform/workspace/api/workspaceApi'
import type { CreateTopupResponse } from '@/platform/workspace/api/workspaceApi'
import { billingOperation } from '@/platform/workspace/composables/billingOperationTestUtils'
import type { BillingOperation } from '@/platform/workspace/composables/billingOperationTestUtils'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { mockBillingContext } from '@/utils/__tests__/mockBillingContext'

import TopUpCreditsDialogContentWorkspace from './TopUpCreditsDialogContentWorkspace.vue'
import { stubFirebaseAuthHarness } from '@/utils/__tests__/stubAccountIdentityPort'

const mockReportError = vi.hoisted(() => vi.fn())

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: mockReportError
}))

const mockToastAdd = vi.fn()

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

vi.mock(import('@/composables/billing/useBillingContext'))

vi.mock(import('@/platform/workspace/composables/useBillingCapabilities'))

vi.mock(import('@/platform/settings/composables/useSettingsDialog'))

vi.mock(import('@/platform/telemetry'))

vi.mock(import('firebase/auth'), { spy: true })
const mockClearPendingTopup = vi.hoisted(() => vi.fn())
vi.mock<unknown>(import('@/composables/billing/usePendingTopup'), () => ({
  usePendingTopup: () => ({ clearPendingTopup: mockClearPendingTopup })
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

function renderDialog(
  props: Partial<
    InstanceType<typeof TopUpCreditsDialogContentWorkspace>['$props']
  > = {}
) {
  mockBillingContext()
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
  stubFirebaseAuthHarness()
})

beforeEach(() => {
  vi.mocked(useDialogStore().closeDialog).mockImplementation(() => {})
  Object.assign(useAuthStore(), { userId: 'user-1' })
  Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'workspace-1' })
  sessionStorage.clear()
  clearCheckoutJourney()
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
    setIsAddingCredits(false)
    setTopupActionOperation(undefined)

    setHasSavedPaymentMethod(true)
    vi.mocked(useBillingOperationStore().startOperation).mockImplementation(
      () => {
        setIsAddingCredits(true)
        return new Promise(() => {})
      }
    )
  })

  it('fires a started event before the purchase resolves', async () => {
    vi.mocked(mockBillingContext().topup).mockResolvedValue(
      topupResponse('pending')
    )

    renderDialog()
    await clickAddCredits()
    await userEvent.click(screen.getByRole('button', { name: 'Pay $50.00' }))

    await waitFor(() =>
      expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledWith({
        operation: 'topup',
        stage: 'started',
        outcome: 'pending'
      })
    )
    expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledWith({
      operation: 'operation',
      stage: 'started',
      outcome: 'pending',
      operation_type: 'topup'
    })
  })

  it('attributes the topup journey to the surface that opened the dialog', async () => {
    renderDialog({ source: 'agent_paywall' })

    await waitFor(() =>
      expect(useTelemetry()?.trackCheckoutJourneyEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'entered',
          entry_flow: 'topup',
          entry_source: 'agent_paywall'
        })
      )
    )
  })

  it('keeps the settings-billing attribution when no source is named', async () => {
    renderDialog()

    await waitFor(() =>
      expect(useTelemetry()?.trackCheckoutJourneyEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'entered',
          entry_source: 'settings_billing'
        })
      )
    )
  })

  it('does not inherit a prior surface when a top-up is opened from a different one', async () => {
    resolveCheckoutJourney({
      actorUid: 'user-1',
      workspaceId: 'workspace-1',
      entryFlow: 'topup',
      entrySource: 'settings_billing',
      assignment: { status: 'unavailable' }
    })

    renderDialog({ source: 'agent_paywall' })

    await waitFor(() =>
      expect(useTelemetry()?.trackCheckoutJourneyEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'entered',
          entry_source: 'agent_paywall'
        })
      )
    )
    expect(getActiveCheckoutJourney()?.entry_source).toBe('agent_paywall')
  })

  it('still resumes a journey from the same surface rather than restarting it', async () => {
    const first = resolveCheckoutJourney({
      actorUid: 'user-1',
      workspaceId: 'workspace-1',
      entryFlow: 'topup',
      entrySource: 'settings_billing',
      intent: 'settings_billing',
      assignment: { status: 'unavailable' }
    })
    assert(first.status === 'active')

    renderDialog()
    await nextTick()

    expect(getActiveCheckoutJourney()?.journey_id).toBe(first.record.journey_id)
  })

  it('enters a topup journey on mount and correlates the purchase', async () => {
    vi.mocked(mockBillingContext().topup).mockResolvedValue(
      topupResponse('pending')
    )

    renderDialog()
    await waitFor(() =>
      expect(useTelemetry()?.trackCheckoutJourneyEvent).toHaveBeenCalledWith(
        expect.objectContaining({ phase: 'entered', entry_flow: 'topup' })
      )
    )

    await clickAddCredits()
    await userEvent.click(screen.getByRole('button', { name: 'Pay $50.00' }))

    await waitFor(() =>
      expect(useTelemetry()?.trackCheckoutJourneyEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'operation_linked',
          billing_op_id: 'op-1'
        })
      )
    )
    const phases = (
      vi.mocked(useTelemetry()?.trackCheckoutJourneyEvent)?.mock.calls ?? []
    ).map(([event]) => event.phase)
    expect(phases.indexOf('submitted')).toBeLessThan(
      phases.indexOf('operation_linked')
    )
    expect(phases.filter((phase) => phase === 'entered')).toHaveLength(1)

    // One denominator: every phase of a top-up must carry the same journey.
    const journeyIds = new Set(
      (
        vi.mocked(useTelemetry()?.trackCheckoutJourneyEvent)?.mock.calls ?? []
      ).map(([event]) => event.checkout_journey_id)
    )
    expect(journeyIds.size).toBe(1)
  })

  it('does not correlate the operation to a journey replaced mid-request', async () => {
    let resolveTopup: (value: CreateTopupResponse) => void = () => {}
    vi.mocked(mockBillingContext().topup).mockReturnValue(
      new Promise<CreateTopupResponse>((resolve) => {
        resolveTopup = resolve
      })
    )

    renderDialog()
    await clickAddCredits()
    await userEvent.click(screen.getByRole('button', { name: 'Pay $50.00' }))
    await waitFor(() =>
      expect(useTelemetry()?.trackCheckoutJourneyEvent).toHaveBeenCalledWith(
        expect.objectContaining({ phase: 'submitted' })
      )
    )

    // A different journey takes the slot while the request is pending, so the
    // response must not bind to whatever happens to be active when it lands.
    clearCheckoutJourney()
    const replacement = resolveCheckoutJourney({
      actorUid: 'user-1',
      workspaceId: 'workspace-1',
      entryFlow: 'initial_subscription',
      entrySource: 'pricing',
      assignment: { status: 'unavailable' }
    })
    resolveTopup(topupResponse('completed'))
    await waitFor(() =>
      expect(mockBillingContext().fetchBalance).toHaveBeenCalled()
    )

    const phases = (
      vi.mocked(useTelemetry()?.trackCheckoutJourneyEvent)?.mock.calls ?? []
    ).map(([event]) => event.phase)
    expect(phases).toContain('submitted')
    expect(phases).not.toContain('operation_linked')
    expect(replacement.status).toBe('active')
    expect(getActiveCheckoutJourney()?.billing_op_id).toBeUndefined()
  })

  it('reports failure telemetry when topup resolves with no response', async () => {
    renderDialog()
    await clickAddCredits()
    await userEvent.click(screen.getByRole('button', { name: 'Pay $50.00' }))

    await waitFor(() =>
      expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledWith({
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
    expect(mockBillingContext().topup).not.toHaveBeenCalled()
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

    renderDialog()
    await clickAddCredits()

    await userEvent.click(
      await screen.findByRole('button', { name: 'Manage billing' })
    )

    expect(mockBillingContext().manageSubscription).toHaveBeenCalledTimes(1)
  })

  it('reports and surfaces a billing-portal opening failure', async () => {
    setHasSavedPaymentMethod(false)
    const failure = new Error('portal down')
    vi.mocked(mockBillingContext().manageSubscription).mockRejectedValue(
      failure
    )

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
    vi.mocked(mockBillingContext().topup).mockRejectedValue(
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

  // The server holds the invoice open and refuses a replacement purchase while
  // it is, so a restart here would be rejected. Say what is true instead, and
  // never offer an action the server will turn down.
  it('explains a top-up parked with no link instead of offering a restart', async () => {
    setIsAddingCredits(true)
    setTopupActionOperation({
      opId: 'op-parked',
      status: 'pending',
      phase: 'awaiting_invoice_payment',
      actionUrl: null
    })

    renderDialog()

    expect(screen.getByText('Verify your payment')).toBeInTheDocument()
    expect(
      screen.getByText(/bank needs to approve this payment/)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/can't be started until this one completes/)
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Complete verification' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Start over' })
    ).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'OK' }))

    expect(useDialogStore().closeDialog).toHaveBeenCalledWith({
      key: 'top-up-credits'
    })
    expect(useBillingOperationStore().dismissOperation).not.toHaveBeenCalled()
  })

  // Reachable whenever a purchase is submitted while the previous operation is
  // still open — after Start over on a failed challenge, or from a second tab.
  it('names the still-open purchase when the server refuses a replacement', async () => {
    vi.mocked(mockBillingContext().topup).mockRejectedValue(
      new WorkspaceApiError('conflict', 409, 'SUBSCRIPTION_CHANGE_IN_PROGRESS')
    )

    renderDialog()
    await clickAddCredits()
    await userEvent.click(screen.getByRole('button', { name: 'Pay $50.00' }))

    await waitFor(() =>
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          detail: expect.stringContaining('credit purchase is still open')
        })
      )
    )
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
    useBillingCapabilities().canTopUp = computed(() => false)
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
    const canTopUp = ref(false)
    useBillingCapabilities().canTopUp = computed(() => canTopUp.value)

    setTopupActionOperation({
      opId: 'op-action',
      status: 'pending',
      actionUrl: 'https://verify.example/sensitive-token'
    })

    renderDialog()
    expect(screen.getByText('Select amount')).toBeInTheDocument()

    canTopUp.value = true
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

  it.for([
    {
      rail: 'resolves at issue',
      issue: () => Promise.resolve(topupResponse('pending'))
    },
    {
      rail: 'resolves only at settlement',
      issue: () => new Promise<CreateTopupResponse>(() => {})
    }
  ])(
    'lets the customer start over after a failed challenge when the purchase $rail',
    async ({ issue }) => {
      vi.mocked(mockBillingContext().topup).mockImplementation(issue)

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
    }
  )

  it('ignores a superseded purchase attempt that settles after Start over', async () => {
    let settleFirst!: (response: CreateTopupResponse) => void
    const billing = mockBillingContext()
    vi.mocked(billing.topup)
      .mockImplementationOnce(
        () =>
          new Promise<CreateTopupResponse>((resolve) => {
            settleFirst = resolve
          })
      )
      .mockImplementation(() => new Promise<CreateTopupResponse>(() => {}))

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

    await clickAddCredits()
    const payButton = screen.getByRole('button', { name: 'Pay $50.00' })
    await userEvent.click(payButton)
    await nextTick()
    settleFirst(topupResponse('completed'))
    await waitFor(() => expect(billing.fetchBalance).toHaveBeenCalled())
    await nextTick()

    expect(billing.topup).toHaveBeenCalledTimes(2)
    expect(useDialogStore().closeDialog).not.toHaveBeenCalled()
    expect(payButton).toBeDisabled()
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
    vi.mocked(mockBillingContext().topup).mockResolvedValue(
      topupResponse('pending')
    )

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
    expect(mockBillingContext().topup).toHaveBeenCalledOnce()
  })

  it('unlocks payment and reports an operation start failure', async () => {
    const error = new Error('Operation unavailable')
    vi.mocked(mockBillingContext().topup).mockResolvedValue(
      topupResponse('pending')
    )
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
    expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledWith({
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
    vi.mocked(mockBillingContext().topup).mockResolvedValue(
      topupResponse('completed')
    )

    renderDialog()
    await clickAddCredits()
    await userEvent.click(screen.getByRole('button', { name: 'Pay $50.00' }))

    expect(mockBillingContext().fetchBalance).toHaveBeenCalledOnce()
    expect(mockBillingContext().fetchStatus).toHaveBeenCalledOnce()
    expect(useSettingsDialog().show).toHaveBeenCalledWith('workspace')
    expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledWith({
      operation: 'topup',
      stage: 'succeeded',
      outcome: 'success',
      billing_op_id: 'op-1',
      duration_ms: expect.any(Number)
    })
    expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledWith({
      operation: 'operation',
      stage: 'succeeded',
      outcome: 'success',
      operation_type: 'topup',
      billing_op_id: 'op-1',
      duration_ms: expect.any(Number)
    })
    expect(mockClearPendingTopup).not.toHaveBeenCalled()
  })

  // Completing out of band is the expected outcome here — the copy sends the
  // customer to their bank — and the marker is what refreshes the balance when
  // they come back, so neither exit may discard it.
  it.for([{ control: 'OK' }, { control: 'Close' }])(
    'keeps the pending top-up marker when leaving a parked purchase via $control',
    async ({ control }) => {
      setIsAddingCredits(true)
      setTopupActionOperation({
        opId: 'op-parked',
        status: 'pending',
        phase: 'awaiting_invoice_payment',
        actionUrl: null
      })

      renderDialog()
      await userEvent.click(screen.getByRole('button', { name: control }))

      expect(useDialogStore().closeDialog).toHaveBeenCalled()
      expect(mockClearPendingTopup).not.toHaveBeenCalled()
    }
  )

  it('clears the pending top-up marker when the user closes the dialog', async () => {
    renderDialog()
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(mockClearPendingTopup).toHaveBeenCalled()
    expect(useDialogStore().closeDialog).toHaveBeenCalled()
  })

  it('opens Credits settings after a completed local top-up', async () => {
    mockDistributionTypes.isCloud = false
    vi.mocked(mockBillingContext().topup).mockResolvedValue(
      topupResponse('completed')
    )

    renderDialog()
    await clickAddCredits()
    await userEvent.click(screen.getByRole('button', { name: 'Pay $50.00' }))

    expect(useSettingsDialog().show).toHaveBeenCalledWith('credits')
  })

  it('keeps completed top-up telemetry successful when refresh fails', async () => {
    vi.mocked(mockBillingContext().topup).mockResolvedValue(
      topupResponse('completed')
    )
    vi.mocked(mockBillingContext().fetchBalance).mockRejectedValueOnce(
      new Error('balance unavailable')
    )
    vi.mocked(mockBillingContext().fetchStatus).mockRejectedValueOnce(
      new Error('status unavailable')
    )

    renderDialog()
    await clickAddCredits()
    await userEvent.click(screen.getByRole('button', { name: 'Pay $50.00' }))

    expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledTimes(4)
    expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledWith({
      operation: 'topup',
      stage: 'succeeded',
      outcome: 'success',
      billing_op_id: 'op-1',
      duration_ms: expect.any(Number)
    })
    expect(useSettingsDialog().show).toHaveBeenCalledWith('workspace')
  })

  it('does not refresh balance or status for a pending top-up', async () => {
    vi.mocked(mockBillingContext().topup).mockResolvedValue(
      topupResponse('pending')
    )

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
    expect(mockBillingContext().fetchBalance).not.toHaveBeenCalled()
    expect(mockBillingContext().fetchStatus).not.toHaveBeenCalled()
    expect(useTelemetry()?.trackBillingEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'succeeded' })
    )
  })

  it('does not refresh balance or status for a failed top-up', async () => {
    vi.mocked(mockBillingContext().topup).mockResolvedValue(
      topupResponse('failed')
    )

    renderDialog()
    await clickAddCredits()
    await userEvent.click(screen.getByRole('button', { name: 'Pay $50.00' }))

    expect(mockBillingContext().fetchBalance).not.toHaveBeenCalled()
    expect(mockBillingContext().fetchStatus).not.toHaveBeenCalled()
    expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledWith({
      operation: 'topup',
      stage: 'failed',
      outcome: 'failure',
      billing_op_id: 'op-1',
      failure_category: 'provider_decline',
      duration_ms: expect.any(Number)
    })
    expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledWith({
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
    vi.mocked(mockBillingContext().topup).mockRejectedValue(workspaceApiError)

    renderDialog()
    await clickAddCredits()
    await userEvent.click(screen.getByRole('button', { name: 'Pay $50.00' }))

    await waitFor(() =>
      expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledWith({
        operation: 'topup',
        stage: 'failed',
        outcome: 'failure',
        failure_category: 'api_rejected',
        duration_ms: expect.any(Number)
      })
    )
  })

  it('does not top up after the server capability is revoked', async () => {
    const canTopUp = ref(true)
    useBillingCapabilities().canTopUp = computed(() => canTopUp.value)

    renderDialog()
    await clickAddCredits()
    canTopUp.value = false
    await nextTick()

    expect(screen.getByRole('button', { name: 'Pay $50.00' })).toBeDisabled()

    expect(mockBillingContext().topup).not.toHaveBeenCalled()
    expect(
      useTelemetry()?.trackApiCreditTopupButtonPurchaseClicked
    ).not.toHaveBeenCalled()
    expect(mockToastAdd).not.toHaveBeenCalled()
    expect(useDialogStore().closeDialog).not.toHaveBeenCalled()
  })
})
