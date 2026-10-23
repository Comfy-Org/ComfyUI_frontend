import type {
  BillingTelemetryEvent,
  TopupResult
} from '@comfyorg/account-core/billing'

import { useToast } from '@/components/ui/toast/toastStore'
import type { BalanceInfo } from '@/platform/billing/composables/types'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import {
  failedTopup,
  fakeBillingSdk,
  settledTopup
} from '@/platform/billing/sdk/billingSdkTestUtils'
import type { BillingSdk } from '@/platform/billing/sdk/createBillingSdk'
import { useBillingOperationStore } from '@/platform/billing/stores/billingOperationStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import {
  clearCheckoutJourney,
  getActiveCheckoutJourney,
  resolveCheckoutJourney
} from '@/platform/billing/utils/checkoutJourney'
import { useAuthStore } from '@/stores/authStore'
import { useDialogStore } from '@/stores/dialogStore'
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { useTelemetry } from '@/platform/telemetry'
import { TelemetryRegistry } from '@/platform/telemetry/TelemetryRegistry'
import { DatadogRumTelemetryProvider } from '@/platform/telemetry/providers/cloud/DatadogRumTelemetryProvider'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import {
  WorkspaceApiError,
  workspaceApi
} from '@/platform/workspace/api/workspaceApi'
import type { CreateTopupResponse } from '@/platform/workspace/api/workspaceApi'
import { billingOperation } from '@/platform/billing/composables/billingOperationTestUtils'
import type { BillingOperation } from '@/platform/billing/composables/billingOperationTestUtils'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
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

const mockDistributionTypes = vi.hoisted(() => ({
  isCloud: true,
  isDesktop: false
}))

vi.mock(import('@/platform/distribution/types'), () => mockDistributionTypes)

vi.mock(import('@/platform/billing/composables/useBillingContext'))

vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))

vi.mock(import('@/platform/settings/composables/useSettingsDialog'))

vi.mock(import('@/platform/telemetry'))

vi.mock(import('@/composables/useFeatureFlags'))

const mockCreateBillingSdk = vi.hoisted(() => vi.fn<() => BillingSdk>())
vi.mock(import('@/platform/billing/sdk/createBillingSdk'), () => ({
  createBillingSdk: mockCreateBillingSdk
}))

vi.mock(import('firebase/auth'), { spy: true })
const mockClearPendingTopup = vi.hoisted(() => vi.fn())
const mockStartPendingTopup = vi.hoisted(() => vi.fn())
vi.mock<unknown>(
  import('@/platform/billing/composables/usePendingTopup'),
  () => ({
    usePendingTopup: () => ({
      clearPendingTopup: mockClearPendingTopup,
      startPendingTopup: mockStartPendingTopup
    })
  })
)

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
      operation_type: 'topup',
      billing_client: 'legacy'
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

  it('shows the plan-required line under the presets and drops it on Confirm without charging', async () => {
    const billing = mockBillingContext()
    billing.isInitialized.value = true
    billing.subscriptionState = computed(() => 'never_subscribed')
    renderDialog()

    const line = screen.getByTestId('top-up-plan-credit-line')
    expect(line).toHaveTextContent(
      "Buying credits doesn't start a Cloud plan. Subscribe to run workflows on Cloud."
    )
    expect(
      screen.getByRole('button', { name: '$100' }).compareDocumentPosition(line)
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)

    await clickAddCredits()

    expect(screen.queryByTestId('top-up-plan-credit-line')).toBeNull()
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

  it('says Subscribe keeps runs going while the served free runs remain', () => {
    remoteConfig.value = {
      free_tier_balance: { allowance: 5, remaining: 3, used: 2 }
    }
    onTestFinished(() => {
      remoteConfig.value = {}
    })
    const billing = mockBillingContext()
    billing.isInitialized.value = true
    billing.subscriptionState = computed(() => 'never_subscribed')
    renderDialog()

    expect(screen.getByTestId('top-up-plan-credit-line')).toHaveTextContent(
      "Buying credits doesn't start a Cloud plan. Subscribe to keep running workflows once your free runs are used."
    )
  })

  it('shows no plan line for an active plan', () => {
    const billing = mockBillingContext()
    billing.isInitialized.value = true
    billing.subscriptionState = computed(() => 'active')
    renderDialog()

    expect(screen.getByRole('button', { name: '$50' })).toBeVisible()
    expect(screen.queryByTestId('top-up-plan-credit-line')).toBeNull()
  })

  function renderWithBalance(overrides: Partial<BalanceInfo>) {
    const balance: BalanceInfo = {
      amountMicros: 10_000,
      currency: 'usd',
      effectiveBalanceMicros: 10_000,
      effectiveBalanceAuthoritative: true,
      suggestedTopupAmountCents: null,
      ...overrides
    }
    Object.assign(mockBillingContext(), { balance: computed(() => balance) })
    renderDialog()
  }

  it.for([
    { name: 'the server suggestion', suggested: 11_400, pay: 'Pay $114.00' },
    {
      name: 'the default without a suggestion',
      suggested: null,
      pay: 'Pay $50.00'
    },
    {
      name: 'the default for a suggestion that is not whole dollars',
      suggested: 11_450,
      pay: 'Pay $50.00'
    }
  ])('opens at $name', async ({ suggested, pay }) => {
    renderWithBalance({ suggestedTopupAmountCents: suggested })

    await clickAddCredits()

    expect(screen.getByRole('button', { name: pay })).toBeEnabled()
  })

  function renderBeforeBalanceArrives() {
    const balance = ref<BalanceInfo | null>(null)
    Object.assign(mockBillingContext(), { balance })
    renderDialog()
    return (suggestedTopupAmountCents: number) => {
      balance.value = {
        amountMicros: -10_000,
        currency: 'usd',
        effectiveBalanceMicros: -10_000,
        effectiveBalanceAuthoritative: true,
        suggestedTopupAmountCents
      }
    }
  }

  it('adopts a suggestion that arrives after the dialog opens', async () => {
    const balanceArrives = renderBeforeBalanceArrives()

    balanceArrives(11_400)
    await clickAddCredits()

    expect(screen.getByRole('button', { name: 'Pay $114.00' })).toBeEnabled()
  })

  it('keeps an amount the user chose when the suggestion arrives later', async () => {
    const balanceArrives = renderBeforeBalanceArrives()

    await userEvent.click(screen.getByRole('button', { name: '$25' }))
    balanceArrives(11_400)
    await clickAddCredits()

    expect(screen.getByRole('button', { name: 'Pay $25.00' })).toBeEnabled()
  })

  it('keeps the confirmed amount when the suggestion arrives after confirming', async () => {
    const balanceArrives = renderBeforeBalanceArrives()

    await clickAddCredits()
    balanceArrives(11_400)
    await nextTick()

    expect(screen.getByRole('button', { name: 'Pay $50.00' })).toBeEnabled()
  })

  it('explains that the top-up covers a negative balance first', () => {
    renderWithBalance({
      amountMicros: -10_000,
      effectiveBalanceMicros: -10_000,
      suggestedTopupAmountCents: 11_400
    })

    expect(
      screen.getByText(
        'Your balance is −21,100 credits. This top-up covers that first.'
      )
    ).toBeInTheDocument()
  })

  it.for<{ name: string; balance: Partial<BalanceInfo> }>([
    { name: 'a positive balance', balance: {} },
    {
      name: 'a balance the server could not read',
      balance: {
        amountMicros: -10_000,
        effectiveBalanceMicros: -10_000,
        effectiveBalanceAuthoritative: false
      }
    }
  ])('says nothing about the balance for $name', ({ balance }) => {
    renderWithBalance(balance)

    expect(
      screen.queryByText(/This top-up covers that first/)
    ).not.toBeInTheDocument()
  })

  describe('without a default payment method', () => {
    const checkoutUrl = 'https://checkout.stripe.com/c/pay/cs_test'

    function refuseForNoPaymentMethod() {
      vi.mocked(mockBillingContext().topup).mockRejectedValue(
        new WorkspaceApiError(
          'No default payment method is selected.',
          400,
          'NO_PAYMENT_METHOD'
        )
      )
    }

    async function payAndGetRefused() {
      const rendered = renderDialog()
      await clickAddCredits()
      await userEvent.click(screen.getByRole('button', { name: 'Pay $50.00' }))
      const continueButton = await screen.findByRole('button', {
        name: 'Continue to checkout'
      })
      return { ...rendered, continueButton }
    }

    function stubCheckoutTab() {
      const tab = { opener: window, location: { href: '' }, close: vi.fn() }
      const open = vi.spyOn(window, 'open').mockReturnValue(tab as never)
      return { tab, open }
    }

    function checkoutOpensAt(url: string) {
      vi.spyOn(workspaceApi, 'createTopupCheckout').mockResolvedValue({
        checkout_url: url
      })
    }

    it('offers hosted checkout for the selected amount instead of a dead-end error', async () => {
      refuseForNoPaymentMethod()
      const createCheckout = vi
        .spyOn(workspaceApi, 'createTopupCheckout')
        .mockResolvedValue({ checkout_url: checkoutUrl })
      const { tab, open } = stubCheckoutTab()
      const { continueButton } = await payAndGetRefused()
      expect(
        screen.getByText(
          'This workspace has no card saved for one-click top-ups. Pay on a checkout page instead, or set a default card so future top-ups charge it directly.'
        )
      ).toBeInTheDocument()

      await userEvent.click(continueButton)

      await waitFor(() => expect(tab.location.href).toBe(checkoutUrl))
      expect(open).toHaveBeenCalledExactlyOnceWith('', '_blank')
      expect(createCheckout).toHaveBeenCalledWith(
        5000,
        window.location.href,
        expect.any(AbortSignal)
      )
      expect(mockStartPendingTopup).toHaveBeenCalledOnce()
      expect(
        screen.getByRole('heading', { name: 'Checkout opened in a new tab' })
      ).toBeInTheDocument()
      expect(useDialogStore().closeDialog).not.toHaveBeenCalled()
      expect(mockClearPendingTopup).not.toHaveBeenCalled()
      expect(useToast().error).not.toHaveBeenCalled()
    })

    it('offers Pay again once the user goes back to change the amount', async () => {
      refuseForNoPaymentMethod()
      await payAndGetRefused()

      await userEvent.click(screen.getByRole('button', { name: 'Back' }))
      await userEvent.click(screen.getByRole('button', { name: 'Add credits' }))

      expect(
        screen.getByRole('button', { name: 'Pay $50.00' })
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Continue to checkout' })
      ).not.toBeInTheDocument()
    })

    it('refreshes the workspace balance and status when the user returns from checkout', async () => {
      refuseForNoPaymentMethod()
      checkoutOpensAt(checkoutUrl)
      const { tab } = stubCheckoutTab()
      const { unmount, continueButton } = await payAndGetRefused()
      await userEvent.click(continueButton)
      await waitFor(() => expect(tab.location.href).toBe(checkoutUrl))
      unmount()
      const billing = mockBillingContext()
      vi.mocked(billing.fetchBalance).mockClear()
      vi.mocked(billing.fetchStatus).mockClear()

      window.dispatchEvent(new Event('focus'))

      await waitFor(() => {
        expect(billing.fetchBalance).toHaveBeenCalled()
        expect(billing.fetchStatus).toHaveBeenCalled()
      })
    })

    it('keeps watching after a failed balance read instead of treating it as zero', async () => {
      refuseForNoPaymentMethod()
      checkoutOpensAt(checkoutUrl)
      const { tab } = stubCheckoutTab()
      const billing = mockBillingContext()
      const balanceMicros = ref<number | null>(null)
      Object.assign(billing, {
        balance: computed(() =>
          balanceMicros.value === null
            ? null
            : { amountMicros: balanceMicros.value, currency: 'usd' }
        )
      })
      const { unmount, continueButton } = await payAndGetRefused()
      await userEvent.click(continueButton)
      await waitFor(() => expect(tab.location.href).toBe(checkoutUrl))
      unmount()
      vi.mocked(billing.fetchBalance)
        .mockReset()
        .mockRejectedValueOnce(new Error('balance unavailable'))
        .mockImplementation(async () => {
          balanceMicros.value = 1_000_000
        })
      vi.useFakeTimers()

      try {
        window.dispatchEvent(new Event('focus'))
        await vi.advanceTimersByTimeAsync(2_000)
        expect(billing.fetchBalance).toHaveBeenCalledTimes(2)

        await vi.advanceTimersByTimeAsync(5_000)
        expect(billing.fetchBalance).toHaveBeenCalledTimes(3)
      } finally {
        vi.useRealTimers()
      }
    })

    it('keeps watching until the status is re-read after the balance rises', async () => {
      refuseForNoPaymentMethod()
      checkoutOpensAt(checkoutUrl)
      const { tab } = stubCheckoutTab()
      const billing = mockBillingContext()
      const balanceMicros = ref(1_000_000)
      Object.assign(billing, {
        balance: computed(() => ({
          amountMicros: balanceMicros.value,
          currency: 'usd'
        }))
      })
      const { unmount, continueButton } = await payAndGetRefused()
      await userEvent.click(continueButton)
      await waitFor(() => expect(tab.location.href).toBe(checkoutUrl))
      unmount()
      vi.mocked(billing.fetchBalance)
        .mockReset()
        .mockImplementation(async () => {
          balanceMicros.value = 2_000_000
        })
      vi.mocked(billing.fetchStatus)
        .mockReset()
        .mockRejectedValueOnce(new Error('status unavailable'))
        .mockResolvedValue(undefined)
      vi.useFakeTimers()

      try {
        window.dispatchEvent(new Event('focus'))
        await vi.advanceTimersByTimeAsync(2_000)
        expect(billing.fetchStatus).toHaveBeenCalledTimes(2)

        await vi.advanceTimersByTimeAsync(5_000)
        expect(billing.fetchStatus).toHaveBeenCalledTimes(2)
      } finally {
        vi.useRealTimers()
      }
    })

    it('hands checkout to the Desktop host and returns it to the billing-web return page', async () => {
      refuseForNoPaymentMethod()
      const createCheckout = vi
        .spyOn(workspaceApi, 'createTopupCheckout')
        .mockResolvedValue({ checkout_url: checkoutUrl })
      window.__comfyDesktop2 = {}
      remoteConfig.value = { billing_web_url: 'https://testbilling.comfy.org' }
      const open = vi.spyOn(window, 'open').mockReturnValue(null)
      const appUrl = window.location.href

      try {
        await userEvent.click((await payAndGetRefused()).continueButton)

        expect(
          await screen.findByRole('heading', {
            name: 'Checkout opened in a new tab'
          })
        ).toBeInTheDocument()
        expect(createCheckout).toHaveBeenCalledWith(
          5000,
          'https://testbilling.comfy.org/return/topup',
          expect.any(AbortSignal)
        )
        expect(open).toHaveBeenCalledWith(checkoutUrl, '_blank')
        expect(window.location.href).toBe(appUrl)
      } finally {
        delete window.__comfyDesktop2
        remoteConfig.value = {}
      }
    })

    const portalUrl = 'https://billing.stripe.com/p/session/flow_test'

    function blockNewTabs() {
      return vi.spyOn(window, 'open').mockReturnValue(null)
    }

    function stopBrowserFollowingLinks() {
      const holdNavigation = (event: Event) => event.preventDefault()
      document.addEventListener('click', holdNavigation)
      onTestFinished(() =>
        document.removeEventListener('click', holdNavigation)
      )
    }

    it.for([
      {
        page: 'card settings',
        url: portalUrl,
        heading: "Payment page didn't open",
        link: 'Open payment page',
        trigger: 'Set a default card',
        session: () =>
          vi
            .spyOn(workspaceApi, 'getPaymentPortalUrl')
            .mockResolvedValue({ url: portalUrl })
      }
    ])(
      'links to the blocked $page session without opening another one',
      async ({ url, heading, link, trigger, session }) => {
        refuseForNoPaymentMethod()
        const createSession = session()
        const open = blockNewTabs()
        stopBrowserFollowingLinks()
        const appUrl = window.location.href
        await payAndGetRefused()

        await userEvent.click(screen.getByRole('button', { name: trigger }))

        expect(
          await screen.findByRole('heading', { name: heading })
        ).toBeInTheDocument()
        const sessionLink = screen.getByRole('link', { name: link })
        expect(sessionLink).toHaveAttribute('href', url)
        expect(sessionLink).toHaveAttribute('target', '_blank')
        expect(sessionLink).toHaveAttribute('rel', 'noopener')
        expect(window.location.href).toBe(appUrl)

        await userEvent.click(sessionLink)

        expect(createSession).toHaveBeenCalledOnce()
        expect(open).toHaveBeenCalledExactlyOnceWith('', '_blank')
      }
    )

    function newCheckoutTab() {
      return { opener: window, location: { href: '' }, close: vi.fn() }
    }

    it('mints the checkout session only once Open checkout gets a tab', async () => {
      refuseForNoPaymentMethod()
      const createCheckout = vi
        .spyOn(workspaceApi, 'createTopupCheckout')
        .mockResolvedValue({ checkout_url: checkoutUrl })
      const checkoutTab = newCheckoutTab()
      const open = vi
        .spyOn(window, 'open')
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(checkoutTab as never)
      const appUrl = window.location.href
      await userEvent.click((await payAndGetRefused()).continueButton)

      expect(
        await screen.findByRole('heading', { name: "Checkout didn't open" })
      ).toBeInTheDocument()
      expect(createCheckout).not.toHaveBeenCalled()

      await userEvent.click(
        screen.getByRole('button', { name: 'Open checkout' })
      )

      await waitFor(() => expect(checkoutTab.location.href).toBe(checkoutUrl))
      expect(createCheckout).toHaveBeenCalledOnce()
      expect(open).toHaveBeenCalledTimes(2)
      expect(window.location.href).toBe(appUrl)
      expect(
        screen.getByRole('heading', { name: 'Checkout opened in a new tab' })
      ).toBeInTheDocument()
    })

    it('returns to Pay when the blocked checkout fails to start a session', async () => {
      refuseForNoPaymentMethod()
      vi.spyOn(workspaceApi, 'createTopupCheckout').mockRejectedValue(
        new WorkspaceApiError('Checkout down', 502)
      )
      vi.spyOn(window, 'open')
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(newCheckoutTab() as never)
      await userEvent.click((await payAndGetRefused()).continueButton)

      await userEvent.click(
        await screen.findByRole('button', { name: 'Open checkout' })
      )

      expect(await screen.findByRole('alert')).toHaveTextContent(
        "The payment page couldn't open. Nothing was charged. Try again."
      )
      expect(
        screen.getByRole('button', { name: 'Continue to checkout' })
      ).toBeInTheDocument()
    })

    it('hands off to the open checkout once the checkout tab opens', async () => {
      refuseForNoPaymentMethod()
      checkoutOpensAt(checkoutUrl)
      vi.spyOn(window, 'open').mockReturnValue(newCheckoutTab() as never)
      await userEvent.click((await payAndGetRefused()).continueButton)

      expect(
        await screen.findByRole('heading', {
          name: 'Checkout opened in a new tab'
        })
      ).toBeInTheDocument()
      expect(
        screen.getByText(
          'Credits are added to this workspace as soon as your payment goes through.'
        )
      ).toBeInTheDocument()
      expect(mockStartPendingTopup).toHaveBeenCalledOnce()
      expect(useDialogStore().closeDialog).not.toHaveBeenCalled()
    })

    it('abandons a checkout still opening once this tab starts switching workspace, then opens the next attempt', async () => {
      refuseForNoPaymentMethod()
      const handedSignals: AbortSignal[] = []
      vi.spyOn(workspaceApi, 'createTopupCheckout')
        .mockImplementationOnce((_amountCents, _returnUrl, signal) => {
          if (signal) handedSignals.push(signal)
          return new Promise((_resolve, reject) =>
            signal?.addEventListener('abort', () => reject(signal.reason))
          )
        })
        .mockImplementationOnce(async (_amountCents, _returnUrl, signal) => {
          if (signal) handedSignals.push(signal)
          return { checkout_url: checkoutUrl }
        })
      const abandonedTab = newCheckoutTab()
      const nextTab = newCheckoutTab()
      vi.spyOn(window, 'open')
        .mockReturnValueOnce(abandonedTab as never)
        .mockReturnValueOnce(nextTab as never)
      const { continueButton } = await payAndGetRefused()
      await userEvent.click(continueButton)
      await waitFor(() => expect(handedSignals).toHaveLength(1))

      Object.assign(useTeamWorkspaceStore(), {
        workspaceTransitionGeneration: 1
      })

      expect(handedSignals[0].aborted).toBe(true)
      await waitFor(() => expect(abandonedTab.close).toHaveBeenCalledOnce())
      expect(abandonedTab.location.href).toBe('')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()

      await userEvent.click(
        screen.getByRole('button', { name: 'Continue to checkout' })
      )

      await waitFor(() => expect(nextTab.location.href).toBe(checkoutUrl))
      expect(handedSignals[1].aborted).toBe(false)
    })

    describe('reopening checkout from the hand-off', () => {
      const reopenedUrl = 'https://checkout.stripe.com/c/pay/cs_test_reopened'

      async function openCheckoutThenReopen({
        reopenTab,
        reopened
      }: {
        reopenTab: ReturnType<typeof newCheckoutTab> | null
        reopened: () => Promise<{ checkout_url: string }>
      }) {
        refuseForNoPaymentMethod()
        const createCheckout = vi
          .spyOn(workspaceApi, 'createTopupCheckout')
          .mockResolvedValueOnce({ checkout_url: checkoutUrl })
          .mockImplementationOnce(reopened)
        const open = vi
          .spyOn(window, 'open')
          .mockReturnValueOnce(newCheckoutTab() as never)
          .mockReturnValueOnce(reopenTab as never)
        await userEvent.click((await payAndGetRefused()).continueButton)
        await userEvent.click(
          await screen.findByRole('button', { name: 'Reopen checkout' })
        )
        return { createCheckout, open }
      }

      it('creates a fresh checkout session in a new tab', async () => {
        const reopenTab = newCheckoutTab()
        const { createCheckout, open } = await openCheckoutThenReopen({
          reopenTab,
          reopened: async () => ({ checkout_url: reopenedUrl })
        })

        await waitFor(() => expect(reopenTab.location.href).toBe(reopenedUrl))
        expect(createCheckout).toHaveBeenCalledTimes(2)
        expect(open).toHaveBeenCalledTimes(2)
        expect(
          screen.getByRole('heading', { name: 'Checkout opened in a new tab' })
        ).toBeInTheDocument()
      })

      it('mints no session when the reopened tab is blocked', async () => {
        const { createCheckout } = await openCheckoutThenReopen({
          reopenTab: null,
          reopened: async () => ({ checkout_url: reopenedUrl })
        })

        expect(
          await screen.findByRole('heading', { name: "Checkout didn't open" })
        ).toBeInTheDocument()
        expect(createCheckout).toHaveBeenCalledOnce()
      })

      it('returns to the hand-off when the blocked reopen fails to start a session', async () => {
        const { open } = await openCheckoutThenReopen({
          reopenTab: null,
          reopened: async () => {
            throw new WorkspaceApiError('Checkout down', 502)
          }
        })
        open.mockReturnValueOnce(newCheckoutTab() as never)

        await userEvent.click(
          await screen.findByRole('button', { name: 'Open checkout' })
        )

        expect(await screen.findByRole('alert')).toHaveTextContent(
          "The payment page couldn't open. Nothing was charged. Try again."
        )
        expect(
          screen.getByRole('heading', { name: 'Checkout opened in a new tab' })
        ).toBeInTheDocument()

        await userEvent.click(
          screen.getAllByRole('button', { name: 'Close' })[0]
        )

        expect(mockClearPendingTopup).not.toHaveBeenCalled()
      })

      it('keeps the opened checkout pending when the dialog closes on a blocked reopen', async () => {
        await openCheckoutThenReopen({
          reopenTab: null,
          reopened: async () => ({ checkout_url: reopenedUrl })
        })
        await screen.findByRole('heading', { name: "Checkout didn't open" })

        await userEvent.click(screen.getByRole('button', { name: 'Close' }))

        expect(mockClearPendingTopup).not.toHaveBeenCalled()
        expect(useDialogStore().closeDialog).toHaveBeenCalled()
      })

      it('stays on the hand-off and explains a session that could not start', async () => {
        await openCheckoutThenReopen({
          reopenTab: newCheckoutTab(),
          reopened: async () => {
            throw new WorkspaceApiError('Checkout down', 502)
          }
        })

        expect(await screen.findByRole('alert')).toHaveTextContent(
          "The payment page couldn't open. Nothing was charged. Try again."
        )
        expect(
          screen.getByRole('heading', { name: 'Checkout opened in a new tab' })
        ).toBeInTheDocument()
        expect(
          screen.getByRole('button', { name: 'Reopen checkout' })
        ).toBeEnabled()
      })
    })

    function balanceThatRisesOnFetch() {
      const billing = mockBillingContext()
      const balanceMicros = ref(1_000_000)
      Object.assign(billing, {
        balance: computed(() => ({
          amountMicros: balanceMicros.value,
          currency: 'usd'
        }))
      })
      return () =>
        vi.mocked(billing.fetchBalance).mockImplementation(async () => {
          balanceMicros.value = 2_000_000
        })
    }

    it('closes the hand-off once the top-up reaches the balance', async () => {
      refuseForNoPaymentMethod()
      checkoutOpensAt(checkoutUrl)
      stubCheckoutTab()
      const creditTopup = balanceThatRisesOnFetch()
      await userEvent.click((await payAndGetRefused()).continueButton)
      await screen.findByRole('heading', {
        name: 'Checkout opened in a new tab'
      })
      expect(useDialogStore().closeDialog).not.toHaveBeenCalled()

      creditTopup()
      window.dispatchEvent(new Event('focus'))

      await waitFor(() =>
        expect(useDialogStore().closeDialog).toHaveBeenCalledWith({
          key: 'top-up-credits'
        })
      )
      expect(mockClearPendingTopup).not.toHaveBeenCalled()
    })

    it('closes the hand-off when the balance was not loaded before checkout opened', async () => {
      refuseForNoPaymentMethod()
      checkoutOpensAt(checkoutUrl)
      stubCheckoutTab()
      const billing = mockBillingContext()
      const balanceMicros = ref<number | null>(null)
      Object.assign(billing, {
        balance: computed(() =>
          balanceMicros.value === null
            ? null
            : { amountMicros: balanceMicros.value, currency: 'usd' }
        )
      })
      const continueButton = (await payAndGetRefused()).continueButton
      vi.mocked(billing.fetchBalance).mockImplementation(async () => {
        balanceMicros.value = 1_000_000
      })
      await userEvent.click(continueButton)
      await screen.findByRole('heading', {
        name: 'Checkout opened in a new tab'
      })

      vi.mocked(billing.fetchBalance).mockImplementation(async () => {
        balanceMicros.value = 2_000_000
      })
      window.dispatchEvent(new Event('focus'))

      await waitFor(() =>
        expect(useDialogStore().closeDialog).toHaveBeenCalledWith({
          key: 'top-up-credits'
        })
      )
    })

    it.for([
      { control: 'the header close icon', index: 0 },
      { control: 'the Close button', index: 1 }
    ])(
      'keeps watching for the top-up after $control closes the hand-off',
      async ({ index }) => {
        refuseForNoPaymentMethod()
        checkoutOpensAt(checkoutUrl)
        stubCheckoutTab()
        const creditTopup = balanceThatRisesOnFetch()
        const { unmount, continueButton } = await payAndGetRefused()
        await userEvent.click(continueButton)
        await screen.findByRole('heading', {
          name: 'Checkout opened in a new tab'
        })

        await userEvent.click(
          screen.getAllByRole('button', { name: 'Close' })[index]
        )
        unmount()
        const billing = mockBillingContext()
        creditTopup()
        vi.mocked(billing.fetchStatus).mockClear()
        window.dispatchEvent(new Event('focus'))

        expect(useDialogStore().closeDialog).toHaveBeenCalledOnce()
        expect(mockClearPendingTopup).not.toHaveBeenCalled()
        await waitFor(() => expect(billing.fetchStatus).toHaveBeenCalled())
      }
    )

    it('abandons a checkout that resolves after the dialog was dismissed', async () => {
      refuseForNoPaymentMethod()
      let resolveCheckout: (value: { checkout_url: string }) => void = () => {}
      vi.spyOn(workspaceApi, 'createTopupCheckout').mockReturnValue(
        new Promise((resolve) => {
          resolveCheckout = resolve
        })
      )
      const { tab } = stubCheckoutTab()
      const { unmount, continueButton } = await payAndGetRefused()
      await userEvent.click(continueButton)

      unmount()
      resolveCheckout({ checkout_url: checkoutUrl })

      await waitFor(() => expect(tab.close).toHaveBeenCalledOnce())
      expect(tab.location.href).toBe('')
      expect(mockStartPendingTopup).not.toHaveBeenCalled()
      expect(useDialogStore().closeDialog).not.toHaveBeenCalled()
    })

    it('keeps the dialog open and explains a checkout that could not start', async () => {
      refuseForNoPaymentMethod()
      vi.spyOn(workspaceApi, 'createTopupCheckout').mockRejectedValue(
        new WorkspaceApiError('Bad return url', 400, 'INVALID_RETURN_URL')
      )
      const { tab } = stubCheckoutTab()

      await userEvent.click((await payAndGetRefused()).continueButton)

      expect(await screen.findByRole('alert')).toHaveTextContent(
        "The payment page couldn't open. Nothing was charged. Try again."
      )
      expect(useToast().error).not.toHaveBeenCalled()
      expect(tab.close).toHaveBeenCalledOnce()
      expect(mockStartPendingTopup).not.toHaveBeenCalled()
      expect(
        screen.getByRole('button', { name: 'Continue to checkout' })
      ).toBeEnabled()
    })

    describe('setting a default card', () => {
      function portalOpensAt(url: string) {
        return vi
          .spyOn(workspaceApi, 'getPaymentPortalUrl')
          .mockResolvedValue({ url })
      }

      async function clickSetDefaultCard() {
        await userEvent.click(
          screen.getByRole('button', { name: 'Set a default card' })
        )
      }

      it('re-sends Pay for the same amount when the customer returns from the portal', async () => {
        refuseForNoPaymentMethod()
        const listCards = vi.spyOn(workspaceApi, 'listSavedPaymentMethods')
        const getPortal = portalOpensAt(portalUrl)
        const { tab, open } = stubCheckoutTab()
        await payAndGetRefused()

        await clickSetDefaultCard()

        await waitFor(() => expect(tab.location.href).toBe(portalUrl))
        expect(open).toHaveBeenCalledExactlyOnceWith('', '_blank')
        expect(getPortal).toHaveBeenCalledExactlyOnceWith(
          window.location.href,
          'payment_method_update'
        )
        expect(useDialogStore().closeDialog).not.toHaveBeenCalled()

        vi.mocked(mockBillingContext().topup).mockResolvedValue(
          topupResponse('completed')
        )
        window.dispatchEvent(new Event('focus'))

        await waitFor(() =>
          expect(useDialogStore().closeDialog).toHaveBeenCalledWith({
            key: 'top-up-credits'
          })
        )
        expect(mockBillingContext().topup).toHaveBeenLastCalledWith(5000)
        expect(useToast().success).toHaveBeenCalledWith(
          'Credits added successfully!',
          { duration: 5000 }
        )
        expect(listCards).not.toHaveBeenCalled()
      })

      it('keeps the refusal when the retried Pay still has no default card', async () => {
        refuseForNoPaymentMethod()
        const listCards = vi.spyOn(workspaceApi, 'listSavedPaymentMethods')
        portalOpensAt(portalUrl)
        const { tab } = stubCheckoutTab()
        await payAndGetRefused()
        await clickSetDefaultCard()
        await waitFor(() => expect(tab.location.href).toBe(portalUrl))

        window.dispatchEvent(new Event('focus'))
        await waitFor(() =>
          expect(mockBillingContext().topup).toHaveBeenCalledTimes(2)
        )
        await waitFor(() =>
          expect(
            screen.getByRole('button', { name: 'Set a default card' })
          ).toBeEnabled()
        )
        expect(useToast().error).not.toHaveBeenCalled()
        expect(listCards).not.toHaveBeenCalled()
        window.dispatchEvent(new Event('focus'))
        expect(mockBillingContext().topup).toHaveBeenCalledTimes(2)

        vi.mocked(mockBillingContext().topup).mockResolvedValue(
          topupResponse('completed')
        )
        window.dispatchEvent(new Event('blur'))
        window.dispatchEvent(new Event('focus'))
        await waitFor(() =>
          expect(useDialogStore().closeDialog).toHaveBeenCalledWith({
            key: 'top-up-credits'
          })
        )
        expect(mockBillingContext().topup).toHaveBeenCalledTimes(3)
      })

      it('does not retry Pay after this tab switches workspace', async () => {
        refuseForNoPaymentMethod()
        portalOpensAt(portalUrl)
        const { tab } = stubCheckoutTab()
        await payAndGetRefused()
        await clickSetDefaultCard()
        await waitFor(() => expect(tab.location.href).toBe(portalUrl))

        const workspace = useTeamWorkspaceStore()
        const generation = workspace.workspaceTransitionGeneration
        workspace.resetForIdentityChange()
        expect(workspace.workspaceTransitionGeneration).toBe(generation + 1)
        window.dispatchEvent(new Event('focus'))

        await waitFor(() =>
          expect(
            screen.getByRole('button', { name: 'Set a default card' })
          ).toBeEnabled()
        )
        expect(mockBillingContext().topup).toHaveBeenCalledTimes(1)
        expect(mockBillingContext().topup).toHaveBeenCalledWith(5000)
      })

      it('does not retry Pay after Back leaves confirmation', async () => {
        refuseForNoPaymentMethod()
        portalOpensAt(portalUrl)
        const { tab } = stubCheckoutTab()
        await payAndGetRefused()
        await clickSetDefaultCard()
        await waitFor(() => expect(tab.location.href).toBe(portalUrl))

        await userEvent.click(screen.getByRole('button', { name: 'Back' }))
        await userEvent.click(screen.getByRole('button', { name: '$25' }))
        window.dispatchEvent(new Event('focus'))

        await waitFor(() =>
          expect(
            screen.getByRole('button', { name: 'Add credits' })
          ).toBeEnabled()
        )
        expect(mockBillingContext().topup).toHaveBeenCalledTimes(1)
        expect(mockBillingContext().topup).toHaveBeenCalledWith(5000)
      })

      it.for([
        {
          failure: 'a rejected request',
          arrange: () =>
            vi
              .spyOn(workspaceApi, 'getPaymentPortalUrl')
              .mockRejectedValue(new WorkspaceApiError('Portal down', 502))
        },
        {
          failure: 'an empty portal URL',
          arrange: () => portalOpensAt('')
        }
      ])(
        'closes the reserved tab and explains $failure without the server message',
        async ({ arrange }) => {
          refuseForNoPaymentMethod()
          arrange()
          const { tab } = stubCheckoutTab()
          await payAndGetRefused()

          await clickSetDefaultCard()

          await waitFor(() =>
            expect(useToast().error).toHaveBeenCalledWith(
              "Couldn't open card settings",
              { description: 'An unknown error occurred' }
            )
          )
          expect(tab.close).toHaveBeenCalledOnce()
          expect(tab.location.href).toBe('')
          expect(
            screen.getByRole('button', { name: 'Set a default card' })
          ).toBeEnabled()
        }
      )

      function portalPending() {
        const settle = {
          resolve: (_value: { url: string }) => {},
          reject: (_error: Error) => {}
        }
        vi.spyOn(workspaceApi, 'getPaymentPortalUrl').mockReturnValue(
          new Promise((resolve, reject) => {
            settle.resolve = resolve
            settle.reject = reject
          })
        )
        return settle
      }

      function competingTransitions() {
        return ['Back', 'Continue to checkout', 'Set a default card'].map(
          (name) => screen.getByRole('button', { name })
        )
      }

      it.for([
        {
          outcome: 'opens',
          settle: (portal: ReturnType<typeof portalPending>) =>
            portal.resolve({ url: portalUrl }),
          tabHref: portalUrl
        },
        {
          outcome: 'fails',
          settle: (portal: ReturnType<typeof portalPending>) =>
            portal.reject(new WorkspaceApiError('Portal down', 502)),
          tabHref: ''
        }
      ])(
        'locks Back and checkout while the portal request is pending and unlocks them once it $outcome',
        async ({ settle, tabHref }) => {
          refuseForNoPaymentMethod()
          const portal = portalPending()
          const { tab } = stubCheckoutTab()
          await payAndGetRefused()

          await clickSetDefaultCard()

          for (const button of competingTransitions()) {
            expect(button).toBeDisabled()
          }

          settle(portal)

          await waitFor(() => {
            for (const button of competingTransitions()) {
              expect(button).toBeEnabled()
            }
          })
          expect(tab.location.href).toBe(tabHref)
        }
      )

      it('closes the reserved tab without opening the portal when the dialog unmounts mid-request', async () => {
        refuseForNoPaymentMethod()
        const portal = portalPending()
        const { tab } = stubCheckoutTab()
        const { unmount } = await payAndGetRefused()
        await clickSetDefaultCard()

        unmount()
        portal.resolve({ url: portalUrl })

        await waitFor(() => expect(tab.close).toHaveBeenCalledOnce())
        expect(tab.location.href).toBe('')
        expect(useToast().error).not.toHaveBeenCalled()
      })

      it('re-sends Pay once a customer who followed the blocked portal link comes back', async () => {
        refuseForNoPaymentMethod()
        const listCards = vi.spyOn(workspaceApi, 'listSavedPaymentMethods')
        portalOpensAt(portalUrl)
        blockNewTabs()
        stopBrowserFollowingLinks()
        await payAndGetRefused()
        await clickSetDefaultCard()

        await userEvent.click(
          await screen.findByRole('link', { name: 'Open payment page' })
        )
        vi.mocked(mockBillingContext().topup).mockResolvedValue(
          topupResponse('completed')
        )
        window.dispatchEvent(new Event('focus'))

        await waitFor(() =>
          expect(useDialogStore().closeDialog).toHaveBeenCalledWith({
            key: 'top-up-credits'
          })
        )
        expect(mockBillingContext().topup).toHaveBeenLastCalledWith(5000)
        expect(listCards).not.toHaveBeenCalled()
      })

      it.for([
        {
          failure: 'a rejected request',
          arrange: () =>
            vi
              .spyOn(workspaceApi, 'getPaymentPortalUrl')
              .mockRejectedValue(new WorkspaceApiError('Portal down', 502))
        },
        {
          failure: 'an empty portal URL',
          arrange: () => portalOpensAt('')
        }
      ])(
        'explains $failure instead of linking when the portal tab is blocked',
        async ({ arrange }) => {
          refuseForNoPaymentMethod()
          arrange()
          blockNewTabs()
          await payAndGetRefused()

          await clickSetDefaultCard()

          await waitFor(() =>
            expect(useToast().error).toHaveBeenCalledWith(
              "Couldn't open card settings",
              { description: 'An unknown error occurred' }
            )
          )
          expect(
            screen.queryByRole('link', { name: 'Open payment page' })
          ).not.toBeInTheDocument()
          expect(
            screen.getByRole('button', { name: 'Set a default card' })
          ).toBeEnabled()
        }
      )
    })

    it('does not offer checkout for any other refusal', async () => {
      vi.mocked(mockBillingContext().topup).mockRejectedValue(
        new WorkspaceApiError(
          'Unpaid invoice',
          400,
          'OUTSTANDING_PAYMENT_REQUIRED'
        )
      )

      renderDialog()
      await clickAddCredits()
      await userEvent.click(screen.getByRole('button', { name: 'Pay $50.00' }))

      await waitFor(() => expect(useToast().error).toHaveBeenCalled())
      expect(
        screen.queryByRole('button', { name: 'Continue to checkout' })
      ).not.toBeInTheDocument()
    })
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
      expect(useToast().error).toHaveBeenCalledWith('Purchase Failed', {
        description: expect.stringContaining('credit purchase is still open')
      })
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
        attemptStartedAt: expect.any(Number)
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

    renderDialog()
    await clickAddCredits()
    await userEvent.click(screen.getByRole('button', { name: 'Pay $50.00' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Pay $50.00' })).toBeEnabled()
    )
    expect(useToast().error).toHaveBeenCalledWith('Purchase Failed', {
      description: 'Failed to purchase credits: An unknown error occurred'
    })
    expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledWith({
      operation: 'topup',
      stage: 'failed',
      outcome: 'failure',
      billing_op_id: 'op-1',
      failure_category: 'unknown',
      duration_ms: expect.any(Number)
    })
    expect(console.error).toHaveBeenCalledWith('Purchase failed')
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
      billing_client: 'legacy',
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
        paymentIntentSource: 'agent_paywall'
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
        attemptStartedAt: expect.any(Number)
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
      billing_client: 'legacy',
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
    expect(useToast().toasts).toEqual([])
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
        expect(
          vi
            .mocked(useTelemetry()!.trackBillingEvent)
            .mock.calls.filter(([event]) => event.operation === 'operation')
            .map(([event]) => event.billing_client)
        ).toEqual(['sdk', 'sdk'])
      }
    )

    it('recovers a no-payment-method refusal through the SDK hosted checkout', async () => {
      const checkoutUrl = 'https://checkout.stripe.com/c/pay/cs_sdk'
      const harness = fakeBillingSdk()
      mockCreateBillingSdk.mockReturnValue(harness.sdk)
      vi.mocked(harness.sdk.topup.createTopupCheckout).mockResolvedValue({
        status: 'error',
        code: 'NO_PAYMENT_METHOD',
        recoveryAction: 'replace_payment_method'
      })
      vi.mocked(harness.sdk.topup.createHostedTopupCheckout).mockResolvedValue({
        status: 'ok',
        url: checkoutUrl
      })
      vi.mocked(useFeatureFlags().flags).billingSdkTopupRailEnabled = true
      const tab = { opener: window, location: { href: '' }, close: vi.fn() }
      vi.spyOn(window, 'open').mockReturnValue(tab as never)

      renderDialog()
      await clickAddCredits()
      await userEvent.click(screen.getByRole('button', { name: 'Pay $50.00' }))
      await userEvent.click(
        await screen.findByRole('button', { name: 'Continue to checkout' })
      )

      await waitFor(() => expect(tab.location.href).toBe(checkoutUrl))
      expect(harness.sdk.topup.createHostedTopupCheckout).toHaveBeenCalledWith({
        amountCents: 5000,
        returnUrl: window.location.href,
        signal: expect.any(AbortSignal)
      })
    })
  })
})
