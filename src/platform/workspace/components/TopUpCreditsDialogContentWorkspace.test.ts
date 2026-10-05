import type {
  BillingTelemetryEvent,
  TopupResult
} from '@comfyorg/account-core/billing'

import { useToast } from '@/components/ui/toast'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import {
  failedTopup,
  fakeBillingSdk,
  settledTopup
} from '@/platform/workspace/billing/sdk/billingSdkTestUtils'
import type { BillingSdk } from '@/platform/workspace/billing/sdk/createBillingSdk'
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
import { TelemetryRegistry } from '@/platform/telemetry/TelemetryRegistry'
import { DatadogRumTelemetryProvider } from '@/platform/telemetry/providers/cloud/DatadogRumTelemetryProvider'
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
const mockRumAddAction = vi.hoisted(() => vi.fn())

vi.mock<unknown>(import('@datadog/browser-rum'), () => ({
  datadogRum: { addAction: mockRumAddAction }
}))

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

vi.mock(import('@/composables/useFeatureFlags'))

const mockCreateBillingSdk = vi.hoisted(() => vi.fn<() => BillingSdk>())
vi.mock(import('@/platform/workspace/billing/sdk/createBillingSdk'), () => ({
  createBillingSdk: mockCreateBillingSdk
}))

vi.mock(import('firebase/auth'), { spy: true })
const mockClearPendingTopup = vi.hoisted(() => vi.fn())
vi.mock<unknown>(import('@/composables/billing/usePendingTopup'), () => ({
  usePendingTopup: () => ({ clearPendingTopup: mockClearPendingTopup })
}))

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
      plugins: [i18n]
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

const SPARSE_BILLING_FIELDS: ReadonlySet<string> = new Set([
  'stage',
  'operation_type',
  'billing_op_id',
  'failure_category',
  'decline_reason'
])

function billingEvents(operation: BillingTelemetryEvent['operation']) {
  return vi
    .mocked(useTelemetry()!.trackBillingEvent)
    .mock.calls.filter(([event]) => event.operation === operation)
    .map(([event]) =>
      Object.fromEntries(
        Object.entries(event).filter(([field]) =>
          SPARSE_BILLING_FIELDS.has(field)
        )
      )
    )
}

async function clickAddCredits() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Add credits' }))
}

beforeEach(() => {
  vi.mocked(useToast().success).mockImplementation((...args: unknown[]) =>
    mockToastAdd('success', ...args)
  )
  vi.mocked(useToast().error).mockImplementation((...args: unknown[]) =>
    mockToastAdd('error', ...args)
  )
  vi.mocked(useToast().info).mockImplementation((...args: unknown[]) =>
    mockToastAdd('info', ...args)
  )
  vi.mocked(useToast().warning).mockImplementation((...args: unknown[]) =>
    mockToastAdd('warning', ...args)
  )
})

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

  it('enables purchase after capabilities resolve and blocks a revoked capability', async () => {
    const canTopUp = ref(false)
    useBillingCapabilities().canTopUp = computed(() => canTopUp.value)
    renderDialog()
    const addCredits = screen.getByRole('button', { name: 'Add credits' })
    expect(addCredits).toBeDisabled()
    await userEvent.click(addCredits)
    expect(
      screen.queryByRole('button', { name: 'Pay $50.00' })
    ).not.toBeInTheDocument()
    expect(mockBillingContext().topup).not.toHaveBeenCalled()

    canTopUp.value = true
    await nextTick()
    expect(addCredits).toBeEnabled()
    await userEvent.click(addCredits)
    const pay = screen.getByRole('button', { name: 'Pay $50.00' })
    expect(pay).toBeEnabled()

    canTopUp.value = false
    await nextTick()
    expect(pay).toBeDisabled()
    await userEvent.click(pay)
    expect(mockBillingContext().topup).not.toHaveBeenCalled()
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
        outcome: 'pending',
        amount_cents: 5000,
        amount_preset: '50'
      })
    )
    expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledWith({
      operation: 'operation',
      stage: 'started',
      outcome: 'pending',
      operation_type: 'topup'
    })
  })

  it.for([
    {
      name: 'a preset',
      choose: async (user: ReturnType<typeof userEvent.setup>) => {
        await user.click(screen.getByRole('button', { name: '$25' }))
      },
      pay: 'Pay $25.00',
      reported: { amount_cents: 2500, amount_preset: '25' }
    },
    {
      name: 'a typed amount',
      choose: async (user: ReturnType<typeof userEvent.setup>) => {
        const payInput = screen.getByRole('spinbutton', {
          name: 'Amount (USD)'
        })
        await user.tripleClick(payInput)
        await user.keyboard('75{Enter}')
      },
      pay: 'Pay $75.00',
      reported: { amount_cents: 7500, amount_preset: 'custom' }
    },
    {
      name: 'a typed amount that equals a preset',
      choose: async (user: ReturnType<typeof userEvent.setup>) => {
        const payInput = screen.getByRole('spinbutton', {
          name: 'Amount (USD)'
        })
        await user.tripleClick(payInput)
        await user.keyboard('100{Enter}')
      },
      pay: 'Pay $100.00',
      reported: { amount_cents: 10000, amount_preset: 'custom' }
    }
  ])(
    'reports the amount and the preset of $name on the started event',
    async ({ choose, pay, reported }) => {
      vi.mocked(mockBillingContext().topup).mockResolvedValue(
        topupResponse('pending')
      )
      renderDialog({ source: 'deep_link' })

      await choose(userEvent.setup())
      await clickAddCredits()
      await userEvent.click(screen.getByRole('button', { name: pay }))

      await waitFor(() =>
        expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledWith({
          operation: 'topup',
          stage: 'started',
          outcome: 'pending',
          payment_intent_source: 'deep_link',
          ...reported
        })
      )
    }
  )

  it('reaches Datadog with the amount, the preset and the source', async () => {
    const registry = new TelemetryRegistry()
    registry.registerProvider(new DatadogRumTelemetryProvider())
    vi.mocked(useTelemetry).mockReturnValue(registry)
    vi.mocked(mockBillingContext().topup).mockResolvedValue(
      topupResponse('pending')
    )
    renderDialog({ source: 'avatar_menu_plans' })

    await userEvent.click(screen.getByRole('button', { name: '$25' }))
    await clickAddCredits()
    await userEvent.click(screen.getByRole('button', { name: 'Pay $25.00' }))

    await waitFor(() =>
      expect(mockRumAddAction).toHaveBeenCalledWith('billing.topup.started', {
        operation: 'topup',
        stage: 'started',
        outcome: 'pending',
        payment_intent_source: 'avatar_menu_plans',
        amount_cents: 2500,
        amount_preset: '25',
        billing_surface: 'cloud_app'
      })
    )
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

  it('keeps the surface on the journey so an operation recovered after reload can report it', async () => {
    renderDialog({ source: 'deep_link' })

    await waitFor(() =>
      expect(getActiveCheckoutJourney()).toMatchObject({
        entry_source: 'settings_billing',
        payment_intent_source: 'deep_link'
      })
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

  describe('checkout exit', () => {
    function abandonedEvents() {
      return (
        vi.mocked(useTelemetry()?.trackCheckoutJourneyEvent)?.mock.calls ?? []
      )
        .map(([event]) => event)
        .filter((event) => event.phase === 'abandoned')
    }

    it.for([
      { exit: 'dialog_close', leave: (unmount: () => void) => unmount() },
      {
        exit: 'page_exit',
        leave: () => window.dispatchEvent(new Event('pagehide'))
      }
    ] as const)(
      'reports a $exit from a top-up with no operation',
      async ({ exit, leave }) => {
        const { unmount } = renderDialog()
        await nextTick()

        leave(unmount)

        expect(abandonedEvents()).toEqual([
          expect.objectContaining({
            entry_flow: 'topup',
            last_phase: 'entered',
            exit
          })
        ])
      }
    )

    it('reports the close once when the page goes away afterwards', async () => {
      const { unmount } = renderDialog()
      await nextTick()

      unmount()
      window.dispatchEvent(new Event('pagehide'))

      expect(abandonedEvents().map((event) => event.exit)).toEqual([
        'dialog_close'
      ])
    })

    it('reports no exit once the purchase linked an operation', async () => {
      vi.mocked(mockBillingContext().topup).mockResolvedValue(
        topupResponse('pending')
      )
      const { unmount } = renderDialog()
      await clickAddCredits()
      await userEvent.click(screen.getByRole('button', { name: 'Pay $50.00' }))
      await waitFor(() =>
        expect(getActiveCheckoutJourney()?.billing_op_id).toBe('op-1')
      )

      unmount()

      expect(abandonedEvents()).toEqual([])
    })
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
    expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledExactlyOnceWith({
      operation: 'topup',
      stage: 'intent',
      outcome: 'pending'
    })
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
        surface: 'billing',
        errorType: 'billing_portal_open_failure'
      })
    )
    expect(mockToastAdd).toHaveBeenCalledWith(
      'error',
      'Failed to open the billing portal. Please try again.',
      { duration: 5000 }
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
      expect(mockToastAdd).toHaveBeenCalledWith('error', 'Purchase Failed', {
        description:
          'No payment method is saved for this workspace. Add one via Settings → Plan & Credits → Manage billing, then retry the top-up.'
      })
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
      expect(vi.mocked(useToast().error)).toHaveBeenCalledWith(
        expect.any(String),
        {
          description: expect.stringContaining('credit purchase is still open')
        }
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
    expect(vi.mocked(useToast().error)).toHaveBeenCalledWith(
      'Purchase Failed',
      { description: 'Failed to purchase credits: An unknown error occurred' }
    )
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

  // Asserting the whole projected collection rather than one stage: a source
  // dropped from any single emit site leaves the others green, and a funnel
  // whose terminal events are attributed while its `started` is not reads as
  // a conversion cliff rather than a gap.
  it.for([
    { outcome: 'completed', stages: ['intent', 'started', 'succeeded'] },
    { outcome: 'failed', stages: ['intent', 'started', 'failed'] },
    { outcome: 'no response', stages: ['intent', 'started', 'failed'] },
    { outcome: 'rejected', stages: ['intent', 'started', 'failed'] }
  ] as const)(
    'carries the opening surface onto every top-up event when the purchase is $outcome',
    async ({ outcome, stages }) => {
      const topup = vi.mocked(mockBillingContext().topup)
      if (outcome === 'rejected') topup.mockRejectedValue(new Error('declined'))
      else if (outcome === 'no response') topup.mockResolvedValue(undefined)
      else topup.mockResolvedValue(topupResponse(outcome))

      renderDialog({ source: 'agent_paywall' })
      await clickAddCredits()
      await userEvent.click(screen.getByRole('button', { name: 'Pay $50.00' }))

      await waitFor(() =>
        expect(
          vi
            .mocked(useTelemetry()!.trackBillingEvent)
            .mock.calls.map(([event]) => event)
            .filter((event) => event.operation === 'topup')
            .map((event) => [event.stage, event.payment_intent_source])
        ).toEqual(stages.map((stage) => [stage, 'agent_paywall']))
      )
    }
  )

  // A real payment usually settles on the poller, not synchronously, so this
  // hand-off is what carries the source onto the poller's own terminal events.
  it('hands the opening surface to the poller for a pending top-up', async () => {
    vi.mocked(mockBillingContext().topup).mockResolvedValue(
      topupResponse('pending')
    )

    renderDialog({ source: 'agent_paywall' })
    await clickAddCredits()
    await userEvent.click(screen.getByRole('button', { name: 'Pay $50.00' }))

    expect(useBillingOperationStore().startOperation).toHaveBeenCalledWith(
      'op-1',
      'topup',
      {
        attemptStartedAt: expect.any(Number),
        paymentIntentSource: 'agent_paywall',
        autoHandleRequiresAction: true
      }
    )
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

    expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledTimes(5)
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

  describe('on the billing SDK rail', () => {
    it.for<{
      outcome: string
      result: TopupResult
      operationTerminal: Record<string, string>
      topupTerminal: Record<string, string>
    }>([
      {
        outcome: 'a settled purchase',
        result: {
          status: 'ok',
          operation: settledTopup('succeeded'),
          creditsReconciled: true
        },
        operationTerminal: { stage: 'succeeded', billing_op_id: 'op-1' },
        topupTerminal: { stage: 'succeeded', billing_op_id: 'op-1' }
      },
      {
        outcome: 'a purchase this tab stopped watching',
        result: { status: 'unsettled', operation: settledTopup('timed_out') },
        operationTerminal: {
          stage: 'timeout',
          billing_op_id: 'op-1',
          failure_category: 'poll_timeout'
        },
        topupTerminal: {
          stage: 'failed',
          billing_op_id: 'op-1',
          failure_category: 'poll_timeout'
        }
      },
      {
        outcome: 'a decline',
        result: {
          status: 'declined',
          operation: failedTopup('insufficient_funds')
        },
        operationTerminal: {
          stage: 'failed',
          billing_op_id: 'op-1',
          failure_category: 'provider_decline',
          decline_reason: 'insufficient_funds'
        },
        topupTerminal: {
          stage: 'failed',
          billing_op_id: 'op-1',
          failure_category: 'provider_decline'
        }
      },
      {
        outcome: 'a purchase support must reconcile',
        result: {
          status: 'unsettled',
          operation: settledTopup('reconciliation_needed')
        },
        operationTerminal: {
          stage: 'failed',
          billing_op_id: 'op-1',
          failure_category: 'reconciliation_needed'
        },
        topupTerminal: {
          stage: 'failed',
          billing_op_id: 'op-1',
          failure_category: 'reconciliation_needed'
        }
      },
      {
        outcome: 'a refusal that carries no HTTP status',
        result: {
          status: 'error',
          code: 'NO_PAYMENT_METHOD',
          recoveryAction: 'replace_payment_method'
        },
        operationTerminal: {
          stage: 'failed',
          failure_category: 'api_rejected'
        },
        topupTerminal: { stage: 'failed', failure_category: 'api_rejected' }
      },
      {
        outcome: 'a purchase the scope moved out from under',
        result: { status: 'error', code: 'SUPERSEDED' },
        operationTerminal: {
          stage: 'failed',
          failure_category: 'stale_operation'
        },
        topupTerminal: { stage: 'failed', failure_category: 'stale_operation' }
      },
      {
        outcome: 'an amount the request contract refused',
        result: { status: 'error', code: 'INVALID_AMOUNT' },
        operationTerminal: { stage: 'failed', failure_category: 'validation' },
        topupTerminal: { stage: 'failed', failure_category: 'validation' }
      },
      {
        outcome: 'a request that never reached the server',
        result: { status: 'error', code: 'REQUEST_FAILED' },
        operationTerminal: { stage: 'failed', failure_category: 'network' },
        topupTerminal: { stage: 'failed', failure_category: 'network' }
      }
    ])(
      'reports $outcome as one terminal carrying what the SDK settled',
      async ({ result, operationTerminal, topupTerminal }) => {
        const harness = fakeBillingSdk()
        mockCreateBillingSdk.mockReturnValue(harness.sdk)
        vi.mocked(harness.sdk.topup.createTopupCheckout).mockResolvedValue(
          result
        )
        vi.mocked(useFeatureFlags().flags).billingSdkTopupRailEnabled = true
        vi.spyOn(console, 'error').mockImplementation(() => {})

        renderDialog()
        await clickAddCredits()
        await userEvent.click(
          screen.getByRole('button', { name: 'Pay $50.00' })
        )

        await waitFor(() =>
          expect(billingEvents('operation')).toEqual([
            { stage: 'started', operation_type: 'topup' },
            { operation_type: 'topup', ...operationTerminal }
          ])
        )
        expect(billingEvents('topup')).toEqual([
          { stage: 'intent' },
          { stage: 'started' },
          topupTerminal
        ])
      }
    )
  })
})
