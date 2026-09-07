import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { BillingOpStatusResponse } from '@/platform/workspace/api/workspaceApi'

const { mockHandleNextAction, mockLoadStripe, mockFeatureFlags } = vi.hoisted(
  () => ({
    mockHandleNextAction: vi.fn(),
    mockLoadStripe: vi.fn(),
    mockFeatureFlags: { embeddedCheckoutEnabled: true }
  })
)

vi.mock('@stripe/stripe-js/pure', () => ({
  loadStripe: mockLoadStripe
}))

const mockFetchStatus = vi.fn()
const mockFetchBalance = vi.fn()
const mockReconcileSubscriptionSuccess = vi.fn()
const mockRefreshCapabilities = vi.fn()
const mockDistributionTypes = vi.hoisted(() => ({ isCloud: true }))

vi.mock('@/platform/distribution/types', () => mockDistributionTypes)

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    fetchStatus: mockFetchStatus,
    fetchBalance: mockFetchBalance,
    reconcileSubscriptionSuccess: mockReconcileSubscriptionSuccess
  })
}))

vi.mock('@/platform/workspace/composables/useBillingCapabilities', () => ({
  useBillingCapabilities: () => ({
    refresh: mockRefreshCapabilities
  })
}))

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: mockFeatureFlags
  })
}))

const mockToastAdd = vi.fn()
const mockToastRemove = vi.fn()

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({
    add: mockToastAdd,
    remove: mockToastRemove
  })
}))

vi.mock('@/platform/workspace/api/workspaceApi', () => ({
  workspaceApi: {
    getBillingOpStatus: vi.fn()
  }
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => key
}))

const mockSettingsDialogShow = vi.fn()

vi.mock('@/platform/settings/composables/useSettingsDialog', () => ({
  useSettingsDialog: () => ({
    show: mockSettingsDialogShow,
    hide: vi.fn(),
    showAbout: vi.fn()
  })
}))

const mockCloseDialog = vi.fn()

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({
    closeDialog: mockCloseDialog
  })
}))

const mockTrackBillingEvent = vi.fn()
const mockTrackMonthlySubscriptionSucceeded = vi.fn()

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackBillingEvent: mockTrackBillingEvent,
    trackMonthlySubscriptionSucceeded: mockTrackMonthlySubscriptionSucceeded
  })
}))

const mockUpdateActiveWorkspace = vi.fn()
const mockActiveWorkspaceId = ref('workspace-1')

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    get activeWorkspaceId() {
      return mockActiveWorkspaceId.value
    },
    updateActiveWorkspace: mockUpdateActiveWorkspace
  })
}))

import { workspaceApi } from '@/platform/workspace/api/workspaceApi'

import { useBillingOperationStore } from './billingOperationStore'

describe('billingOperationStore', () => {
  beforeEach(() => {
    mockDistributionTypes.isCloud = true
    mockActiveWorkspaceId.value = 'workspace-1'
    mockFeatureFlags.embeddedCheckoutEnabled = true
    vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY', 'pk_test_3ds')
    mockHandleNextAction.mockResolvedValue({})
    mockLoadStripe.mockResolvedValue({
      handleNextAction: mockHandleNextAction
    })
  })

  describe('startOperation', () => {
    it('creates a pending operation', () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'pending',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'subscription')

      expect(store.operations.size).toBe(1)
      const operation = store.getOperation('op-1')
      expect(operation).toBeDefined()
      expect(operation?.status).toBe('pending')
      expect(operation?.type).toBe('subscription')
      expect(store.hasPendingOperations).toBe(true)
    })

    it('exposes a validated recovered action before the first poll completes', () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockReturnValue(
        new Promise(() => {})
      )

      const store = useBillingOperationStore()
      void store.startOperation(
        'op-recovered',
        'subscription',
        undefined,
        'https://invoice.stripe.com/sensitive-token'
      )

      expect(store.subscriptionActionOperation).toMatchObject({
        opId: 'op-recovered',
        actionUrl: 'https://invoice.stripe.com/sensitive-token',
        authenticationRequiredSeen: true
      })
    })

    it('rejects an insecure recovered action URL', () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockReturnValue(
        new Promise(() => {})
      )

      const store = useBillingOperationStore()
      void store.startOperation(
        'op-recovered',
        'subscription',
        undefined,
        'http://invoice.stripe.com/sensitive-token'
      )

      expect(store.getOperation('op-recovered')).toMatchObject({
        actionUrl: null,
        authenticationRequiredSeen: false
      })
      expect(store.subscriptionActionOperation).toBeUndefined()
    })

    it('does not create duplicate operations', () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'pending',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'subscription')
      void store.startOperation('op-1', 'topup')

      expect(store.operations.size).toBe(1)
      expect(store.getOperation('op-1')?.type).toBe('subscription')
    })

    it('returns the in-flight terminal promise for duplicate starts', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'succeeded',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      const first = store.startOperation('op-1', 'cancel')
      const second = store.startOperation('op-1', 'cancel')

      await vi.advanceTimersByTimeAsync(0)

      const [firstOutcome, secondOutcome] = await Promise.all([first, second])
      expect(firstOutcome.status).toBe('succeeded')
      expect(secondOutcome.status).toBe('succeeded')

      const afterTerminal = await store.startOperation('op-1', 'cancel')
      expect(afterTerminal.status).toBe('succeeded')
    })

    it('shows immediate processing toast for subscription operations', () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'pending',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'subscription')

      expect(mockToastAdd).toHaveBeenCalledWith({
        severity: 'info',
        summary: 'billingOperation.subscriptionProcessing',
        group: 'billing-operation'
      })
    })

    it('does not show a processing toast when the checkout owns progress', () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'pending',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'subscription', {
        suppressProcessingToast: true
      })

      expect(mockToastAdd).not.toHaveBeenCalled()
    })

    it('shows immediate processing toast for topup operations', () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'pending',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'topup')

      expect(mockToastAdd).toHaveBeenCalledWith({
        severity: 'info',
        summary: 'billingOperation.topupProcessing',
        group: 'billing-operation'
      })
    })
  })

  describe('polling success', () => {
    it('emits only the generic lifecycle for a recovered subscription operation', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-recovered',
        status: 'succeeded',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-recovered', 'subscription')

      await vi.advanceTimersByTimeAsync(0)

      expect(mockTrackBillingEvent.mock.calls).toEqual([
        [
          {
            operation: 'operation',
            stage: 'started',
            outcome: 'pending',
            operation_type: 'subscription'
          }
        ],
        [
          {
            operation: 'operation',
            stage: 'succeeded',
            outcome: 'success',
            billing_op_id: 'op-recovered',
            operation_type: 'subscription',
            tier: undefined,
            cycle: undefined,
            checkout_type: undefined,
            payment_intent_source: undefined,
            duration_ms: 0
          }
        ]
      ])
    })

    it('closes both terminal streams for an initiated subscription operation', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-initiated',
        status: 'succeeded',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-initiated', 'subscription', {
        tier: 'creator',
        cycle: 'monthly',
        checkoutType: 'new',
        attemptStartedAt: Date.now()
      })

      await vi.advanceTimersByTimeAsync(0)

      expect(mockTrackBillingEvent.mock.calls).toEqual([
        [
          {
            operation: 'operation',
            stage: 'succeeded',
            outcome: 'success',
            billing_op_id: 'op-initiated',
            operation_type: 'subscription',
            tier: 'creator',
            cycle: 'monthly',
            checkout_type: 'new',
            payment_intent_source: undefined,
            duration_ms: 0
          }
        ],
        [
          {
            operation: 'subscription_checkout',
            stage: 'succeeded',
            outcome: 'success',
            tier: 'creator',
            cycle: 'monthly',
            checkout_type: 'new',
            payment_intent_source: undefined,
            billing_op_id: 'op-initiated',
            duration_ms: 0
          }
        ]
      ])
    })

    it('updates status and shows toast on success', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'succeeded',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      })
      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'subscription')

      await vi.advanceTimersByTimeAsync(0)

      const operation = store.getOperation('op-1')
      expect(operation?.status).toBe('succeeded')
      expect(store.hasPendingOperations).toBe(false)
      expect(mockRefreshCapabilities).toHaveBeenCalledOnce()

      expect(mockReconcileSubscriptionSuccess).toHaveBeenCalledOnce()
      expect(mockFetchStatus).not.toHaveBeenCalled()
      expect(mockFetchBalance).not.toHaveBeenCalled()

      expect(mockToastAdd).toHaveBeenCalledWith({
        severity: 'success',
        summary: 'billingOperation.subscriptionSuccess',
        life: 5000
      })
    })

    it('leaves the checkout dialog open on subscription success', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'succeeded',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'subscription')

      await vi.advanceTimersByTimeAsync(0)

      expect(mockCloseDialog).not.toHaveBeenCalledWith({
        key: 'subscription-required'
      })
      expect(mockSettingsDialogShow).not.toHaveBeenCalled()
    })

    it('closes the top-up dialog and opens settings on topup success', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'succeeded',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'topup')

      await vi.advanceTimersByTimeAsync(0)

      expect(mockCloseDialog).toHaveBeenCalledWith({ key: 'top-up-credits' })
      expect(mockSettingsDialogShow).toHaveBeenCalledWith('workspace')
    })

    it('opens Credits settings after a polled local topup succeeds', async () => {
      mockDistributionTypes.isCloud = false
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'succeeded',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'topup')

      await vi.advanceTimersByTimeAsync(0)

      expect(mockSettingsDialogShow).toHaveBeenCalledWith('credits')
    })

    it('fires purchase telemetry on subscription success', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'succeeded',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'subscription', {
        attemptStartedAt: Date.now()
      })

      await vi.advanceTimersByTimeAsync(0)

      expect(mockTrackBillingEvent).toHaveBeenCalledWith({
        operation: 'subscription_checkout',
        stage: 'succeeded',
        outcome: 'success',
        tier: undefined,
        cycle: undefined,
        checkout_type: undefined,
        payment_intent_source: undefined,
        billing_op_id: 'op-1',
        duration_ms: expect.any(Number)
      })
    })

    it('also fires the generic subscription-success event for non-canonical providers', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'succeeded',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'subscription', {
        tier: 'creator',
        cycle: 'yearly',
        checkoutType: 'new',
        attemptStartedAt: Date.now()
      })

      await vi.advanceTimersByTimeAsync(0)

      expect(mockTrackMonthlySubscriptionSucceeded).toHaveBeenCalledWith({
        tier: 'creator',
        cycle: 'yearly',
        checkout_type: 'new',
        payment_intent_source: undefined,
        billing_op_id: 'op-1'
      })
    })

    it('does not fire the generic subscription-success event for topup or cancel', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'succeeded',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'topup')

      await vi.advanceTimersByTimeAsync(0)

      expect(mockTrackMonthlySubscriptionSucceeded).not.toHaveBeenCalled()
    })

    it('does not fire the generic subscription-success event for a downgrade-to-personal success', async () => {
      // A downgrade is churn, not a conversion — trackMonthlySubscriptionSucceeded
      // drives a GA4 "subscription succeeded" conversion goal, so it must not
      // fire here even though downgrades share the 'subscription' op type.
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-downgrade',
        status: 'succeeded',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-downgrade', 'subscription', {
        tier: 'creator',
        cycle: 'monthly',
        checkoutType: 'change',
        downgradeToPersonal: {
          memberRemovalCount: 1,
          memberRemovalFailures: 0,
          targetTier: 'creator',
          startedAt: Date.now()
        }
      })

      await vi.advanceTimersByTimeAsync(0)

      expect(mockTrackMonthlySubscriptionSucceeded).not.toHaveBeenCalled()
      expect(mockTrackBillingEvent).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'downgrade_to_personal' })
      )
    })

    it('emits downgrade success only after the billing operation succeeds', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-downgrade',
        status: 'succeeded',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-downgrade', 'subscription', {
        tier: 'creator',
        cycle: 'monthly',
        checkoutType: 'change',
        attemptStartedAt: Date.now(),
        downgradeToPersonal: {
          memberRemovalCount: 2,
          memberRemovalFailures: 0,
          targetTier: 'creator',
          startedAt: Date.now()
        }
      })

      expect(mockTrackBillingEvent).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(0)

      expect(mockTrackBillingEvent).toHaveBeenCalledWith({
        operation: 'downgrade_to_personal',
        stage: 'succeeded',
        outcome: 'success',
        member_removal_count: 2,
        member_removal_failures: 0,
        target_tier: 'creator',
        duration_ms: expect.any(Number)
      })
    })

    it('fires canonical topup success telemetry', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'succeeded',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'topup', {
        attemptStartedAt: Date.now()
      })

      await vi.advanceTimersByTimeAsync(0)

      expect(mockTrackBillingEvent).toHaveBeenCalledWith({
        operation: 'topup',
        stage: 'succeeded',
        outcome: 'success',
        billing_op_id: 'op-1',
        duration_ms: expect.any(Number)
      })
    })

    // Parity with .failed/.timeout, which fire for all three types: a
    // succeeded/(succeeded+failed) ratio reads a permanent 0% for any type
    // missing from the numerator.
    it.for(['subscription', 'topup', 'cancel'] as const)(
      'fires billing.operation.succeeded for a %s operation',
      async (type) => {
        vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
          id: 'op-1',
          status: 'succeeded',
          started_at: new Date().toISOString()
        })

        const store = useBillingOperationStore()
        void store.startOperation('op-1', type, {
          tier: 'creator',
          cycle: 'monthly',
          checkoutType: 'new',
          paymentIntentSource: 'subscription_required'
        })

        await vi.advanceTimersByTimeAsync(0)

        expect(mockTrackBillingEvent).toHaveBeenCalledWith({
          operation: 'operation',
          stage: 'succeeded',
          outcome: 'success',
          billing_op_id: 'op-1',
          operation_type: type,
          tier: 'creator',
          cycle: 'monthly',
          checkout_type: 'new',
          payment_intent_source: 'subscription_required',
          duration_ms: expect.any(Number)
        })
      }
    )

    it('shows topup success message for topup operations', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'succeeded',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'topup')

      await vi.advanceTimersByTimeAsync(0)

      expect(mockToastAdd).toHaveBeenCalledWith({
        severity: 'success',
        summary: 'billingOperation.topupSuccess',
        life: 5000
      })
    })

    it('reports duration_ms as the time elapsed since the operation started', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus)
        .mockResolvedValueOnce({
          id: 'op-1',
          status: 'pending',
          started_at: new Date().toISOString()
        })
        .mockResolvedValue({
          id: 'op-1',
          status: 'succeeded',
          started_at: new Date().toISOString()
        })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'topup')

      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(1500)

      const successCall = mockTrackBillingEvent.mock.calls.find(
        ([event]) =>
          event.operation === 'operation' && event.stage === 'succeeded'
      )
      expect(successCall?.[0].duration_ms).toBeGreaterThanOrEqual(1500)
    })

    it('computes duration_ms from the caller-supplied attemptStartedAt, not from when startOperation() itself ran', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus)
        .mockResolvedValueOnce({
          id: 'op-1',
          status: 'pending',
          started_at: new Date().toISOString()
        })
        .mockResolvedValue({
          id: 'op-1',
          status: 'succeeded',
          started_at: new Date().toISOString()
        })

      const store = useBillingOperationStore()
      // Simulate the canonical `started` event having fired 300ms before the
      // initiating API call returned and startOperation() itself ran.
      const attemptStartedAt = Date.now() - 300
      void store.startOperation('op-1', 'topup', { attemptStartedAt })

      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(1500)

      const successCall = mockTrackBillingEvent.mock.calls.find(
        ([event]) => event.operation === 'topup' && event.stage === 'succeeded'
      )
      // Poll-observed time alone is ~1500ms; duration_ms must also include the
      // 300ms initiation latency that preceded startOperation() running.
      expect(successCall?.[0].duration_ms).toBeGreaterThanOrEqual(1800)
    })

    it('removes the received toast when operation succeeds', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'succeeded',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'subscription')

      const receivedToast = mockToastAdd.mock.calls[0][0]

      await vi.advanceTimersByTimeAsync(0)

      expect(mockToastRemove).toHaveBeenCalledWith(receivedToast)
    })
  })

  describe('polling failure', () => {
    it('does not expose backend details on subscription failure', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'failed',
        error_message: 'workflow failed',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'subscription')

      await vi.advanceTimersByTimeAsync(0)

      const operation = store.getOperation('op-1')
      expect(operation?.status).toBe('failed')
      expect(operation?.errorMessage).toBe(
        'billingOperation.subscriptionFailedDetail'
      )
      expect(store.hasPendingOperations).toBe(false)

      expect(mockToastAdd).toHaveBeenCalledWith({
        severity: 'error',
        summary: 'billingOperation.subscriptionFailed',
        detail: 'billingOperation.subscriptionFailedDetail',
        life: 7000
      })
      expect(mockTrackBillingEvent).toHaveBeenCalledWith({
        operation: 'operation',
        stage: 'failed',
        outcome: 'failure',
        billing_op_id: 'op-1',
        operation_type: 'subscription',
        tier: undefined,
        cycle: undefined,
        checkout_type: undefined,
        payment_intent_source: undefined,
        failure_category: 'provider_decline',
        duration_ms: expect.any(Number)
      })
    })

    it('categorizes a topup poll failure as a provider decline too', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'failed',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'topup')

      await vi.advanceTimersByTimeAsync(0)

      expect(mockTrackBillingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          operation_type: 'topup',
          failure_category: 'provider_decline'
        })
      )
    })

    it('stays silent when a checkout was superseded by a new plan choice', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'failed',
        error_message: 'checkout_superseded',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'subscription')

      await vi.advanceTimersByTimeAsync(0)

      expect(store.getOperation('op-1')?.status).toBe('failed')
      expect(mockToastAdd).not.toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
      expect(mockTrackBillingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'failed',
          billing_op_id: 'op-1',
          failure_category: 'stale_operation'
        })
      )
    })

    it('categorizes a cancel poll failure as an api rejection, not a provider decline', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'failed',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'cancel')

      await vi.advanceTimersByTimeAsync(0)

      expect(mockTrackBillingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          operation_type: 'cancel',
          failure_category: 'api_rejected'
        })
      )
    })

    it('categorises both events when a superseded op was a downgrade', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'failed',
        error_message: 'checkout_superseded',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'subscription', {
        downgradeToPersonal: {
          memberRemovalCount: 2,
          memberRemovalFailures: 0,
          targetTier: 'free',
          startedAt: Date.now()
        }
      })

      await vi.advanceTimersByTimeAsync(0)

      // Both emissions must agree: a downgrade that was merely replaced is not
      // an unexplained billing failure in either event stream.
      expect(mockTrackBillingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'operation',
          stage: 'failed',
          failure_category: 'stale_operation'
        })
      )
      expect(mockTrackBillingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'downgrade_to_personal',
          stage: 'failed',
          failure_category: 'stale_operation'
        })
      )
      expect(mockTrackBillingEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({ failure_category: 'unknown' })
      )
    })

    it('reports duration_ms as the time elapsed since the operation started', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus)
        .mockResolvedValueOnce({
          id: 'op-1',
          status: 'pending',
          started_at: new Date().toISOString()
        })
        .mockResolvedValue({
          id: 'op-1',
          status: 'failed',
          started_at: new Date().toISOString()
        })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'topup')

      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(1500)

      expect(mockTrackBillingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'operation',
          stage: 'failed',
          duration_ms: expect.any(Number)
        })
      )
      const failureCall = mockTrackBillingEvent.mock.calls.find(
        ([event]) => event.operation === 'operation' && event.stage === 'failed'
      )
      expect(failureCall?.[0].duration_ms).toBeGreaterThanOrEqual(1500)
    })

    it('uses default message when no error_message in response', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'failed',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'topup')

      await vi.advanceTimersByTimeAsync(0)

      expect(mockToastAdd).toHaveBeenCalledWith({
        severity: 'error',
        summary: 'billingOperation.topupFailed',
        detail: undefined,
        life: 7000
      })
    })

    it('categorizes a downgrade-to-personal poll failure as an api rejection, not a provider decline', async () => {
      // Downgrade-to-personal never touches a card, so a poll failure here
      // can't be a card decline regardless of the shared 'subscription' type.
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-downgrade',
        status: 'failed',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-downgrade', 'subscription', {
        downgradeToPersonal: {
          memberRemovalCount: 1,
          memberRemovalFailures: 0,
          targetTier: 'creator',
          startedAt: Date.now()
        }
      })

      await vi.advanceTimersByTimeAsync(0)

      expect(mockTrackBillingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'operation',
          operation_type: 'subscription',
          failure_category: 'api_rejected'
        })
      )
      expect(mockTrackBillingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'downgrade_to_personal',
          failure_category: 'api_rejected'
        })
      )
      expect(mockTrackBillingEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({ failure_category: 'provider_decline' })
      )
    })

    it('categorizes a subscription poll failure naming a connectivity issue as network, not a provider decline', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'failed',
        error_message: 'network connection lost',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'subscription')

      await vi.advanceTimersByTimeAsync(0)

      expect(mockTrackBillingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          operation_type: 'subscription',
          failure_category: 'network'
        })
      )
    })

    it.for([
      {
        type: 'subscription' as const,
        errorMessage: 'insufficient_funds',
        summary: 'billingOperation.subscriptionFailed',
        detail: 'billingOperation.insufficientFundsDetail'
      },
      {
        type: 'topup' as const,
        errorMessage: 'card_declined',
        summary: 'billingOperation.topupFailed',
        detail: 'billingOperation.paymentDeclinedDetail'
      }
    ])(
      'shows an actionable $errorMessage message for $type failures',
      async ({ type, errorMessage, summary, detail }) => {
        vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
          id: 'op-1',
          status: 'failed',
          error_message: errorMessage,
          started_at: new Date().toISOString()
        })

        const store = useBillingOperationStore()
        void store.startOperation('op-1', type)

        await vi.advanceTimersByTimeAsync(0)

        expect(store.getOperation('op-1')?.errorMessage).toBe(detail)
        expect(mockToastAdd).toHaveBeenCalledWith({
          severity: 'error',
          summary,
          detail,
          life: 7000
        })
      }
    )
  })

  describe('payment authentication recovery', () => {
    it('does not initialize embedded recovery while the flag is off', async () => {
      mockFeatureFlags.embeddedCheckoutEnabled = false
      vi.mocked(workspaceApi.getBillingOpStatus)
        .mockResolvedValueOnce({
          id: 'op-3ds',
          status: 'pending',
          authentication_state: 'requires_action',
          payment_intent_client_secret: 'pi_secret_current',
          started_at: new Date().toISOString()
        })
        .mockResolvedValue({
          id: 'op-3ds',
          status: 'succeeded',
          authentication_state: 'succeeded',
          started_at: new Date().toISOString()
        })

      const store = useBillingOperationStore()
      const terminal = store.startOperation('op-3ds', 'subscription', {
        autoHandleRequiresAction: true
      })
      await vi.advanceTimersByTimeAsync(0)

      expect(store.getOperation('op-3ds')?.authenticationState).toBeNull()
      expect(mockLoadStripe).not.toHaveBeenCalled()
      await expect(store.retryPaymentAuthentication('op-3ds')).resolves.toBe(
        false
      )

      await vi.advanceTimersByTimeAsync(1_500)
      await expect(terminal).resolves.toMatchObject({ status: 'succeeded' })
      expect(mockHandleNextAction).not.toHaveBeenCalled()
    })

    it('recovers when Stripe.js fails to load', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-3ds',
        status: 'pending',
        authentication_state: 'requires_action',
        payment_intent_client_secret: 'pi_secret_current',
        started_at: new Date().toISOString()
      })
      mockLoadStripe.mockRejectedValue(new Error('Stripe.js blocked'))

      const store = useBillingOperationStore()
      void store.startOperation('op-3ds', 'subscription', {
        autoHandleRequiresAction: true,
        suppressProcessingToast: true
      })
      await vi.advanceTimersByTimeAsync(0)

      expect(store.getOperation('op-3ds')).toMatchObject({
        status: 'pending',
        authenticationState: 'failed_retryable',
        canRetryAuthentication: true,
        isAuthenticating: false,
        errorMessage: 'Stripe.js blocked'
      })
    })

    it('auto-runs requires_action once and keeps polling after challenge failure, without relaunching Stripe', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-3ds',
        status: 'pending',
        authentication_state: 'requires_action',
        payment_intent_client_secret: 'pi_secret_current',
        started_at: new Date().toISOString()
      })
      mockHandleNextAction.mockResolvedValue({
        error: { message: 'Challenge was closed' }
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-3ds', 'subscription', {
        autoHandleRequiresAction: true,
        suppressProcessingToast: true
      })
      await vi.advanceTimersByTimeAsync(0)

      expect(mockHandleNextAction).toHaveBeenCalledOnce()
      expect(mockHandleNextAction).toHaveBeenCalledWith({
        clientSecret: 'pi_secret_current'
      })
      expect(store.getOperation('op-3ds')).toMatchObject({
        status: 'pending',
        authenticationState: 'failed_retryable',
        canRetryAuthentication: true,
        isAuthenticating: false,
        errorMessage: 'Challenge was closed'
      })
      expect(JSON.stringify([...store.operations.values()])).not.toContain(
        'pi_secret_current'
      )

      await vi.advanceTimersByTimeAsync(60_000)
      expect(mockHandleNextAction).toHaveBeenCalledOnce()
      expect(
        vi.mocked(workspaceApi.getBillingOpStatus).mock.calls.length
      ).toBeGreaterThan(1)
      expect(store.getOperation('op-3ds')).toMatchObject({
        authenticationState: 'failed_retryable',
        errorMessage: 'Challenge was closed'
      })
    })

    it('resolves a challenge-failure presentation when the payment turns out to have succeeded', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus)
        .mockResolvedValueOnce({
          id: 'op-3ds',
          status: 'pending',
          authentication_state: 'requires_action',
          payment_intent_client_secret: 'pi_secret_current',
          started_at: new Date().toISOString()
        })
        .mockResolvedValue({
          id: 'op-3ds',
          status: 'succeeded',
          authentication_state: 'succeeded',
          started_at: new Date().toISOString()
        })
      mockHandleNextAction.mockResolvedValue({
        error: { message: 'Challenge was closed' }
      })

      const store = useBillingOperationStore()
      const terminal = store.startOperation('op-3ds', 'subscription', {
        autoHandleRequiresAction: true,
        suppressProcessingToast: true
      })
      await vi.advanceTimersByTimeAsync(0)

      expect(store.getOperation('op-3ds')?.authenticationState).toBe(
        'failed_retryable'
      )

      await vi.advanceTimersByTimeAsync(31_000)
      expect((await terminal).status).toBe('succeeded')
      expect(mockHandleNextAction).toHaveBeenCalledOnce()
    })

    it('retries explicitly and resumes polling after verification succeeds', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus)
        .mockResolvedValueOnce({
          id: 'op-3ds',
          status: 'pending',
          authentication_state: 'failed_retryable',
          payment_intent_client_secret: 'pi_secret_current',
          started_at: new Date().toISOString()
        })
        .mockResolvedValueOnce({
          id: 'op-3ds',
          status: 'pending',
          authentication_state: 'processing',
          started_at: new Date().toISOString()
        })
        .mockResolvedValueOnce({
          id: 'op-3ds',
          status: 'succeeded',
          authentication_state: 'succeeded',
          started_at: new Date().toISOString()
        })

      const store = useBillingOperationStore()
      const terminal = store.startOperation('op-3ds', 'subscription', {
        suppressProcessingToast: true
      })
      await vi.advanceTimersByTimeAsync(0)

      expect(store.getOperation('op-3ds')?.authenticationState).toBe(
        'failed_retryable'
      )
      await expect(store.retryPaymentAuthentication('op-3ds')).resolves.toBe(
        true
      )
      await vi.advanceTimersByTimeAsync(0)

      expect(mockHandleNextAction).toHaveBeenCalledWith({
        clientSecret: 'pi_secret_current'
      })
      expect(store.getOperation('op-3ds')?.authenticationState).toBe(
        'processing'
      )

      await vi.advanceTimersByTimeAsync(1_500)
      expect((await terminal).status).toBe('succeeded')
      expect(JSON.stringify([...store.operations.values()])).not.toContain(
        'pi_secret_current'
      )
    })

    it('shows a safe declined-card detail while preserving authentication retry', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-declined',
        status: 'pending',
        authentication_state: 'failed_retryable',
        decline_reason: 'card_declined',
        payment_intent_client_secret: 'pi_secret_current',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-declined', 'subscription', {
        suppressProcessingToast: true
      })
      await vi.advanceTimersByTimeAsync(0)

      expect(store.subscriptionActionOperation).toMatchObject({
        opId: 'op-declined',
        status: 'pending',
        authenticationState: 'failed_retryable',
        canRetryAuthentication: true,
        errorMessage: 'billingOperation.paymentDeclinedDetail'
      })
      expect(mockHandleNextAction).not.toHaveBeenCalled()

      await expect(
        store.retryPaymentAuthentication('op-declined')
      ).resolves.toBe(true)
      expect(mockHandleNextAction).toHaveBeenCalledWith({
        clientSecret: 'pi_secret_current'
      })
    })

    it('keeps authentication declines actionable without retrying automatically', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-authentication-failed',
        status: 'pending',
        authentication_state: 'failed_retryable',
        decline_reason: 'authentication_failed',
        payment_intent_client_secret: 'pi_secret_current',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-authentication-failed', 'subscription', {
        suppressProcessingToast: true
      })
      await vi.advanceTimersByTimeAsync(0)

      expect(store.subscriptionActionOperation).toMatchObject({
        authenticationState: 'failed_retryable',
        canRetryAuthentication: true,
        errorMessage: 'billingOperation.authenticationFailedDetail'
      })
      expect(mockHandleNextAction).not.toHaveBeenCalled()
    })

    it('remains retryable after retry failure and never relaunches Stripe automatically', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-3ds',
        status: 'pending',
        authentication_state: 'failed_retryable',
        payment_intent_client_secret: 'pi_secret_current',
        started_at: new Date().toISOString()
      })
      mockHandleNextAction.mockResolvedValue({
        error: { message: 'Verification failed again' }
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-3ds', 'subscription')
      await vi.advanceTimersByTimeAsync(0)
      await expect(store.retryPaymentAuthentication('op-3ds')).resolves.toBe(
        false
      )

      expect(store.getOperation('op-3ds')).toMatchObject({
        authenticationState: 'failed_retryable',
        canRetryAuthentication: true,
        errorMessage: 'Verification failed again'
      })
      await vi.advanceTimersByTimeAsync(60_000)
      expect(mockHandleNextAction).toHaveBeenCalledOnce()
      expect(store.getOperation('op-3ds')).toMatchObject({
        authenticationState: 'failed_retryable',
        canRetryAuthentication: true,
        errorMessage: 'Verification failed again'
      })
    })

    it('exposes a recovered failed_retryable operation before any automatic action', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-recovered',
        status: 'pending',
        authentication_state: 'failed_retryable',
        payment_intent_client_secret: 'pi_secret_recovered',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-recovered', 'subscription')
      await vi.advanceTimersByTimeAsync(0)

      expect(store.subscriptionActionOperation).toMatchObject({
        opId: 'op-recovered',
        authenticationState: 'failed_retryable',
        canRetryAuthentication: true
      })
      expect(mockHandleNextAction).not.toHaveBeenCalled()
    })

    it('keeps polling a pending operation that reports failed_retryable, so a later challenge still runs', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus)
        .mockResolvedValueOnce({
          id: 'op-3ds',
          status: 'pending',
          authentication_state: 'failed_retryable',
          started_at: new Date().toISOString()
        })
        .mockResolvedValueOnce({
          id: 'op-3ds',
          status: 'pending',
          authentication_state: 'requires_action',
          payment_intent_client_secret: 'pi_secret_current',
          started_at: new Date().toISOString()
        })
        .mockResolvedValue({
          id: 'op-3ds',
          status: 'succeeded',
          authentication_state: 'succeeded',
          started_at: new Date().toISOString()
        })
      mockHandleNextAction.mockResolvedValue({})

      const store = useBillingOperationStore()
      const terminal = store.startOperation('op-3ds', 'subscription', {
        autoHandleRequiresAction: true,
        suppressProcessingToast: true
      })
      await vi.advanceTimersByTimeAsync(0)

      expect(store.getOperation('op-3ds')).toMatchObject({
        status: 'pending',
        authenticationState: 'failed_retryable',
        canRetryAuthentication: false
      })
      expect(mockHandleNextAction).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(2_000)
      expect(mockHandleNextAction).toHaveBeenCalledWith({
        clientSecret: 'pi_secret_current'
      })

      await vi.advanceTimersByTimeAsync(60_000)
      expect((await terminal).status).toBe('succeeded')
    })

    it('notices a payment completed outside the tab while parked on verification', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus)
        .mockResolvedValueOnce({
          id: 'op-topup',
          status: 'pending',
          authentication_state: 'requires_action',
          action_url: 'https://invoice.stripe.com/i/auth',
          started_at: new Date().toISOString()
        })
        .mockResolvedValue({
          id: 'op-topup',
          status: 'succeeded',
          authentication_state: 'succeeded',
          started_at: new Date().toISOString()
        })

      const store = useBillingOperationStore()
      const terminal = store.startOperation('op-topup', 'topup')
      await vi.advanceTimersByTimeAsync(0)

      expect(store.getOperation('op-topup')).toMatchObject({
        status: 'pending',
        authenticationState: 'requires_action'
      })
      expect(mockHandleNextAction).not.toHaveBeenCalled()

      // The customer authenticates on the hosted page; the server settles the
      // operation and this tab must pick it up on its own next poll.
      await vi.advanceTimersByTimeAsync(31_000)
      expect((await terminal).status).toBe('succeeded')
    })

    it('resumes the fast cadence once this tab completes the challenge', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus)
        .mockResolvedValueOnce({
          id: 'op-3ds',
          status: 'pending',
          authentication_state: 'requires_action',
          payment_intent_client_secret: 'pi_secret_current',
          started_at: new Date().toISOString()
        })
        .mockResolvedValue({
          id: 'op-3ds',
          status: 'succeeded',
          authentication_state: 'succeeded',
          started_at: new Date().toISOString()
        })
      mockHandleNextAction.mockResolvedValue({})

      const store = useBillingOperationStore()
      const terminal = store.startOperation('op-3ds', 'subscription', {
        autoHandleRequiresAction: true,
        suppressProcessingToast: true
      })
      await vi.advanceTimersByTimeAsync(0)

      expect(mockHandleNextAction).toHaveBeenCalledOnce()
      expect(store.getOperation('op-3ds')?.authenticationState).toBe(
        'processing'
      )

      await vi.advanceTimersByTimeAsync(2_000)
      expect(store.getOperation('op-3ds')?.status).toBe('succeeded')
      expect((await terminal).status).toBe('succeeded')
    })

    it('keeps a completed challenge processing when the server echoes requires_action', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus)
        .mockResolvedValueOnce({
          id: 'op-3ds',
          status: 'pending',
          authentication_state: 'requires_action',
          payment_intent_client_secret: 'pi_secret_current',
          started_at: new Date().toISOString()
        })
        .mockResolvedValue({
          id: 'op-3ds',
          status: 'pending',
          authentication_state: 'requires_action',
          payment_intent_client_secret: 'pi_secret_current',
          action_url: 'https://invoice.stripe.com/i/auth',
          started_at: new Date().toISOString()
        })
      mockHandleNextAction.mockResolvedValue({})

      const store = useBillingOperationStore()
      void store.startOperation('op-3ds', 'subscription', {
        autoHandleRequiresAction: true,
        suppressProcessingToast: true
      })
      await vi.advanceTimersByTimeAsync(0)

      expect(store.getOperation('op-3ds')?.authenticationState).toBe(
        'processing'
      )

      await vi.advanceTimersByTimeAsync(31_000)
      expect(mockHandleNextAction).toHaveBeenCalledOnce()
      expect(
        vi.mocked(workspaceApi.getBillingOpStatus).mock.calls.length
      ).toBeGreaterThan(1)
      expect(store.getOperation('op-3ds')).toMatchObject({
        status: 'pending',
        authenticationState: 'processing',
        canRetryAuthentication: false,
        actionUrl: null
      })
    })

    it('does not expose a stale invoice link after in-page verification completes', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus)
        .mockResolvedValueOnce({
          id: 'op-3ds',
          status: 'pending',
          authentication_state: 'requires_action',
          payment_intent_client_secret: 'pi_secret_current',
          started_at: new Date().toISOString()
        })
        .mockResolvedValue({
          id: 'op-3ds',
          status: 'pending',
          authentication_state: 'succeeded',
          action_url: 'https://invoice.stripe.com/i/already-paid',
          started_at: new Date().toISOString()
        })
      mockHandleNextAction.mockResolvedValue({})

      const store = useBillingOperationStore()
      void store.startOperation('op-3ds', 'topup', {
        autoHandleRequiresAction: true,
        suppressProcessingToast: true
      })
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(31_000)

      expect(mockHandleNextAction).toHaveBeenCalledOnce()
      expect(store.getOperation('op-3ds')).toMatchObject({
        authenticationState: 'succeeded',
        actionUrl: null
      })
      expect(store.topupActionOperation).toBeUndefined()
    })

    it('accepts a new challenge arriving after the first one completed', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus)
        .mockResolvedValueOnce({
          id: 'op-3ds',
          status: 'pending',
          authentication_state: 'requires_action',
          payment_intent_client_secret: 'pi_secret_current',
          started_at: new Date().toISOString()
        })
        .mockResolvedValue({
          id: 'op-3ds',
          status: 'pending',
          authentication_state: 'requires_action',
          payment_intent_client_secret: 'pi_secret_new',
          started_at: new Date().toISOString()
        })
      mockHandleNextAction.mockResolvedValue({})

      const store = useBillingOperationStore()
      void store.startOperation('op-3ds', 'subscription', {
        autoHandleRequiresAction: true,
        suppressProcessingToast: true
      })
      await vi.advanceTimersByTimeAsync(0)

      expect(store.getOperation('op-3ds')?.authenticationState).toBe(
        'processing'
      )

      await vi.advanceTimersByTimeAsync(31_000)
      expect(store.getOperation('op-3ds')).toMatchObject({
        authenticationState: 'requires_action',
        canRetryAuthentication: true
      })
    })

    it('keeps processing pending without relaunching Stripe', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-processing',
        status: 'pending',
        authentication_state: 'processing',
        payment_intent_client_secret: 'pi_secret_not_used',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-processing', 'subscription', {
        autoHandleRequiresAction: true
      })
      await vi.advanceTimersByTimeAsync(0)

      expect(store.getOperation('op-processing')).toMatchObject({
        status: 'pending',
        authenticationState: 'processing',
        canRetryAuthentication: false
      })
      expect(mockHandleNextAction).not.toHaveBeenCalled()
    })

    it('terminates polling for reconciliation_needed and retains the operation id', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-reconcile',
        status: 'reconciliation_needed',
        authentication_state: 'reconciliation_needed',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      const terminal = store.startOperation('op-reconcile', 'subscription', {
        suppressProcessingToast: true,
        tier: 'creator',
        cycle: 'monthly',
        checkoutType: 'new',
        attemptStartedAt: Date.now()
      })
      await vi.advanceTimersByTimeAsync(0)

      expect((await terminal).status).toBe('reconciliation_needed')
      expect(store.subscriptionActionOperation).toMatchObject({
        opId: 'op-reconcile',
        status: 'reconciliation_needed'
      })
      await vi.advanceTimersByTimeAsync(60_000)
      expect(workspaceApi.getBillingOpStatus).toHaveBeenCalledOnce()
      expect(mockTrackBillingEvent).toHaveBeenCalledWith({
        operation: 'operation',
        stage: 'failed',
        outcome: 'failure',
        billing_op_id: 'op-reconcile',
        operation_type: 'subscription',
        tier: 'creator',
        cycle: 'monthly',
        checkout_type: 'new',
        payment_intent_source: undefined,
        failure_category: 'reconciliation_needed',
        duration_ms: 0
      })
      expect(mockTrackBillingEvent).toHaveBeenCalledWith({
        operation: 'subscription_checkout',
        stage: 'failed',
        outcome: 'failure',
        tier: 'creator',
        cycle: 'monthly',
        checkout_type: 'new',
        payment_intent_source: undefined,
        billing_op_id: 'op-reconcile',
        failure_category: 'reconciliation_needed',
        duration_ms: 0
      })
    })

    it('terminates polling for reconciliation_needed while the embedded flag is off', async () => {
      mockFeatureFlags.embeddedCheckoutEnabled = false
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-reconcile-legacy',
        status: 'reconciliation_needed',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      const terminal = store.startOperation(
        'op-reconcile-legacy',
        'subscription'
      )
      await vi.advanceTimersByTimeAsync(0)

      expect((await terminal).status).toBe('reconciliation_needed')
      await vi.advanceTimersByTimeAsync(60_000)
      expect(workspaceApi.getBillingOpStatus).toHaveBeenCalledOnce()
    })

    it('handles a redacted retryable status without a capability', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-redacted',
        status: 'pending',
        authentication_state: 'failed_retryable',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-redacted', 'subscription')
      await vi.advanceTimersByTimeAsync(0)

      expect(store.getOperation('op-redacted')).toMatchObject({
        authenticationState: 'failed_retryable',
        canRetryAuthentication: false
      })
      expect(store.isSettingUp).toBe(false)
      await expect(
        store.retryPaymentAuthentication('op-redacted')
      ).resolves.toBe(false)
      expect(mockHandleNextAction).not.toHaveBeenCalled()
    })
  })

  describe('polling timeout', () => {
    it('times out a subscription while its workspace is inactive', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'pending',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'subscription')
      mockActiveWorkspaceId.value = 'workspace-2'

      await vi.advanceTimersByTimeAsync(5 * 60_000 + 8001)

      expect(store.getOperation('op-1')?.status).toBe('timeout')
    })

    it('restarts a subscription operation after a polling timeout', async () => {
      let status: 'pending' | 'succeeded' = 'pending'
      vi.mocked(workspaceApi.getBillingOpStatus).mockImplementation(
        async () => ({
          id: 'op-1',
          status,
          started_at: new Date().toISOString()
        })
      )

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'subscription')

      await vi.advanceTimersByTimeAsync(5 * 60_000 + 8001)
      expect(store.getOperation('op-1')?.status).toBe('timeout')

      status = 'succeeded'
      const retry = store.startOperation('op-1', 'subscription')

      expect(store.getOperation('op-1')?.status).toBe('pending')
      expect(store.isSettingUp).toBe(true)

      await vi.advanceTimersByTimeAsync(0)
      expect((await retry).status).toBe('succeeded')
    })

    it('allows five minutes to discover a subscription action', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'pending',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'subscription')

      await vi.advanceTimersByTimeAsync(0)

      await vi.advanceTimersByTimeAsync(121_000)
      expect(store.getOperation('op-1')?.status).toBe('pending')

      await vi.advanceTimersByTimeAsync(181_000)
      await vi.runAllTimersAsync()

      const operation = store.getOperation('op-1')
      expect(operation?.status).toBe('timeout')
      expect(store.hasPendingOperations).toBe(false)

      expect(mockToastAdd).toHaveBeenCalledWith({
        severity: 'error',
        summary: 'billingOperation.subscriptionTimeout'
      })
    })

    it('reports duration_ms of at least the timeout threshold', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'pending',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'subscription')

      await vi.advanceTimersByTimeAsync(121_000)
      await vi.runAllTimersAsync()

      expect(mockTrackBillingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'operation',
          stage: 'timeout',
          duration_ms: expect.any(Number)
        })
      )
      const timeoutCall = mockTrackBillingEvent.mock.calls.find(
        ([event]) =>
          event.operation === 'operation' && event.stage === 'timeout'
      )
      expect(timeoutCall?.[0].duration_ms).toBeGreaterThanOrEqual(120_000)
    })

    it('keeps a valid action URL pending past discovery and clears it on success', async () => {
      const actionUrl = 'https://verify.example/sensitive-token'
      vi.mocked(workspaceApi.getBillingOpStatus)
        .mockResolvedValueOnce({
          id: 'op-1',
          status: 'pending',
          started_at: new Date().toISOString(),
          action_url: actionUrl
        })
        .mockResolvedValue({
          id: 'op-1',
          status: 'pending',
          started_at: new Date().toISOString()
        })

      const store = useBillingOperationStore()
      const terminal = store.startOperation('op-1', 'subscription')
      await vi.advanceTimersByTimeAsync(0)

      expect(store.getOperation('op-1')?.actionUrl).toBe(actionUrl)
      await vi.advanceTimersByTimeAsync(30_000)
      expect(store.getOperation('op-1')).toMatchObject({
        status: 'pending',
        actionUrl: null,
        authenticationRequiredSeen: true
      })

      await vi.advanceTimersByTimeAsync(4.5 * 60_000)
      expect(store.getOperation('op-1')?.status).toBe('pending')

      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValueOnce({
        id: 'op-1',
        status: 'succeeded',
        started_at: new Date().toISOString()
      })
      await vi.advanceTimersByTimeAsync(30_000)
      expect((await terminal).status).toBe('succeeded')
      expect(store.getOperation('op-1')?.actionUrl).toBeNull()
      expect(JSON.stringify(mockToastAdd.mock.calls)).not.toContain(actionUrl)
      expect(JSON.stringify(mockTrackBillingEvent.mock.calls)).not.toContain(
        actionUrl
      )
    })

    it('replaces the processing toast when the operation parks on a bank challenge', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'pending',
        started_at: new Date().toISOString(),
        action_url: 'https://verify.example/sensitive-token'
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'subscription')

      const processingToast = {
        severity: 'info',
        summary: 'billingOperation.subscriptionProcessing',
        group: 'billing-operation'
      }
      expect(mockToastAdd).toHaveBeenCalledWith(processingToast)

      await vi.advanceTimersByTimeAsync(0)

      expect(mockToastRemove).toHaveBeenCalledWith(processingToast)
      expect(mockToastAdd).toHaveBeenCalledWith({
        severity: 'warn',
        summary: 'billingOperation.subscriptionActionRequired',
        group: 'billing-operation'
      })
    })

    it('announces verification immediately when the action URL is known at start', () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'pending',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation(
        'op-1',
        'topup',
        undefined,
        'https://verify.example/sensitive-token'
      )

      expect(mockToastAdd).toHaveBeenCalledWith({
        severity: 'warn',
        summary: 'billingOperation.topupActionRequired',
        group: 'billing-operation'
      })
      expect(mockToastAdd).not.toHaveBeenCalledWith(
        expect.objectContaining({
          summary: 'billingOperation.topupProcessing'
        })
      )
    })

    it('returns to processing when the action URL clears while still pending', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus)
        .mockResolvedValueOnce({
          id: 'op-1',
          status: 'pending',
          started_at: new Date().toISOString(),
          action_url: 'https://verify.example/sensitive-token'
        })
        .mockResolvedValue({
          id: 'op-1',
          status: 'pending',
          started_at: new Date().toISOString()
        })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'subscription')
      await vi.advanceTimersByTimeAsync(0)

      const actionRequiredToast = {
        severity: 'warn',
        summary: 'billingOperation.subscriptionActionRequired',
        group: 'billing-operation'
      }
      expect(mockToastAdd).toHaveBeenCalledWith(actionRequiredToast)

      // The verification action is gone, so the prompt pointing at it must go
      // too rather than asking for something the customer can no longer do.
      await vi.advanceTimersByTimeAsync(30_000)

      expect(mockToastRemove).toHaveBeenCalledWith(actionRequiredToast)
      expect(mockToastAdd).toHaveBeenLastCalledWith({
        severity: 'info',
        summary: 'billingOperation.subscriptionProcessing',
        group: 'billing-operation'
      })
    })

    it('does not re-announce verification on later polls', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'pending',
        started_at: new Date().toISOString(),
        action_url: 'https://verify.example/sensitive-token'
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'subscription')
      await vi.advanceTimersByTimeAsync(0)

      const actionRequiredAdds = () =>
        mockToastAdd.mock.calls.filter(
          (call) =>
            call[0]?.summary === 'billingOperation.subscriptionActionRequired'
        ).length

      expect(actionRequiredAdds()).toBe(1)

      await vi.advanceTimersByTimeAsync(30_000)
      await vi.advanceTimersByTimeAsync(30_000)

      expect(actionRequiredAdds()).toBe(1)
    })

    it('rejects an action URL received after the discovery deadline', async () => {
      const actionUrl = 'https://verify.example/sensitive-token'
      let resolveStatus!: (response: BillingOpStatusResponse) => void
      vi.mocked(workspaceApi.getBillingOpStatus).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveStatus = resolve
          })
      )

      const store = useBillingOperationStore()
      const terminal = store.startOperation('op-1', 'subscription')
      await vi.advanceTimersByTimeAsync(5 * 60_000 + 1)

      resolveStatus({
        id: 'op-1',
        status: 'pending',
        started_at: new Date().toISOString(),
        action_url: actionUrl
      })
      await vi.advanceTimersByTimeAsync(0)

      expect((await terminal).status).toBe('timeout')
      expect(store.getOperation('op-1')?.actionUrl).toBeNull()
      expect(JSON.stringify([...store.operations.values()])).not.toContain(
        actionUrl
      )
    })

    it('accepts a terminal response received after the discovery deadline', async () => {
      let resolveStatus!: (response: BillingOpStatusResponse) => void
      vi.mocked(workspaceApi.getBillingOpStatus).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveStatus = resolve
          })
      )

      const store = useBillingOperationStore()
      const terminal = store.startOperation('op-1', 'subscription')
      await vi.advanceTimersByTimeAsync(5 * 60_000 + 1)

      resolveStatus({
        id: 'op-1',
        status: 'succeeded',
        started_at: new Date().toISOString()
      })
      await vi.advanceTimersByTimeAsync(0)

      expect((await terminal).status).toBe('succeeded')
    })

    it('ignores non-HTTPS action URLs', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'pending',
        started_at: new Date().toISOString(),
        action_url: 'http://verify.example/sensitive-token'
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'subscription')
      await vi.advanceTimersByTimeAsync(0)

      expect(store.getOperation('op-1')?.actionUrl).toBeNull()
    })

    it('exposes topup actions only for the active workspace', async () => {
      const actionUrl = 'https://verify.example/sensitive-token'
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'pending',
        started_at: new Date().toISOString(),
        action_url: actionUrl
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'topup')
      await vi.advanceTimersByTimeAsync(0)

      expect(store.topupActionOperation?.actionUrl).toBe(actionUrl)
      expect(store.isAddingCredits).toBe(true)

      mockActiveWorkspaceId.value = 'workspace-2'

      expect(store.topupActionOperation).toBeUndefined()
      expect(store.isAddingCredits).toBe(false)
    })

    it('only exposes subscription actions for the active workspace', async () => {
      const actionUrl = 'https://verify.example/sensitive-token'
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'pending',
        started_at: new Date().toISOString(),
        action_url: actionUrl
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'subscription')
      await vi.advanceTimersByTimeAsync(0)

      expect(store.subscriptionActionOperation?.actionUrl).toBe(actionUrl)
      expect(store.isSettingUp).toBe(true)

      mockActiveWorkspaceId.value = 'workspace-2'

      expect(store.subscriptionActionOperation).toBeUndefined()
      expect(store.isSettingUp).toBe(false)
    })

    it('ignores a response that completes after switching workspaces', async () => {
      const actionUrl = 'https://verify.example/sensitive-token'
      let resolveStatus!: (response: BillingOpStatusResponse) => void
      vi.mocked(workspaceApi.getBillingOpStatus).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveStatus = resolve
          })
      )

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'subscription')
      mockActiveWorkspaceId.value = 'workspace-2'

      resolveStatus({
        id: 'op-1',
        status: 'pending',
        started_at: new Date().toISOString(),
        action_url: actionUrl
      })
      await vi.advanceTimersByTimeAsync(0)

      expect(store.getOperation('op-1')).toMatchObject({
        status: 'pending',
        actionUrl: null
      })
      expect(store.subscriptionActionOperation).toBeUndefined()
    })

    it('shows topup timeout message for topup operations', async () => {
      const startedAt = Date.now()
      vi.mocked(workspaceApi.getBillingOpStatus).mockImplementation(
        async () => ({
          id: 'op-1',
          status:
            Date.now() - startedAt > 120_000
              ? ('succeeded' as const)
              : ('pending' as const),
          started_at: new Date().toISOString()
        })
      )

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'topup')

      await vi.advanceTimersByTimeAsync(121_000)
      await vi.runAllTimersAsync()

      expect(mockToastAdd).toHaveBeenCalledWith({
        severity: 'error',
        summary: 'billingOperation.topupTimeout'
      })
    })

    it('keeps polling a topup while authentication is required', async () => {
      const actionUrl = 'https://verify.example/sensitive-token'
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'pending',
        started_at: new Date().toISOString(),
        action_url: actionUrl
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'topup')

      await vi.advanceTimersByTimeAsync(121_000)

      expect(store.getOperation('op-1')).toMatchObject({
        status: 'pending',
        actionUrl,
        authenticationRequiredSeen: true
      })
      expect(mockToastAdd).not.toHaveBeenCalledWith({
        severity: 'error',
        summary: 'billingOperation.topupTimeout'
      })
    })
  })

  describe('cancel operations', () => {
    it('does not show a processing toast for cancel operations', () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'pending',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'cancel')

      expect(mockToastAdd).not.toHaveBeenCalled()
    })

    it('resolves with the succeeded operation and refreshes status', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'succeeded',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      const terminal = store.startOperation('op-1', 'cancel')

      await vi.advanceTimersByTimeAsync(0)
      const operation = await terminal

      expect(operation.status).toBe('succeeded')
      expect(mockFetchStatus).toHaveBeenCalled()
      expect(mockUpdateActiveWorkspace).toHaveBeenCalledWith({
        isSubscribed: false
      })
      expect(mockTrackBillingEvent).toHaveBeenCalledWith({
        operation: 'operation',
        stage: 'succeeded',
        outcome: 'success',
        billing_op_id: 'op-1',
        operation_type: 'cancel',
        duration_ms: expect.any(Number)
      })
    })

    it('resolves the terminal outcome even when the post-success refresh fails', async () => {
      mockFetchStatus.mockRejectedValueOnce(new Error('refresh failed'))
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'succeeded',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      const terminal = store.startOperation('op-1', 'cancel')

      await vi.advanceTimersByTimeAsync(0)
      const operation = await terminal

      expect(operation.status).toBe('succeeded')
    })

    it('does not open the settings dialog or toast on cancel success', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'succeeded',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      const terminal = store.startOperation('op-1', 'cancel')

      await vi.advanceTimersByTimeAsync(0)
      await terminal

      expect(mockSettingsDialogShow).not.toHaveBeenCalled()
      expect(mockToastAdd).not.toHaveBeenCalled()
    })

    it('resolves with a failed operation and default message, no toast', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'failed',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      const terminal = store.startOperation('op-1', 'cancel')

      await vi.advanceTimersByTimeAsync(0)
      const operation = await terminal

      expect(operation.status).toBe('failed')
      expect(operation.errorMessage).toBe('billingOperation.cancelFailed')
      expect(mockUpdateActiveWorkspace).not.toHaveBeenCalled()
      expect(mockToastAdd).not.toHaveBeenCalled()
      expect(mockTrackBillingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'operation',
          stage: 'failed',
          billing_op_id: 'op-1',
          operation_type: 'cancel'
        })
      )
    })

    it('resolves with a timeout operation after 2 minutes, no toast', async () => {
      const startedAt = Date.now()
      vi.mocked(workspaceApi.getBillingOpStatus).mockImplementation(
        async () => ({
          id: 'op-1',
          status:
            Date.now() - startedAt > 120_000
              ? ('succeeded' as const)
              : ('pending' as const),
          started_at: new Date().toISOString()
        })
      )

      const store = useBillingOperationStore()
      const terminal = store.startOperation('op-1', 'cancel')

      await vi.advanceTimersByTimeAsync(121_000)
      await vi.runAllTimersAsync()
      const operation = await terminal

      expect(operation.status).toBe('timeout')
      expect(operation.errorMessage).toBe('billingOperation.cancelTimeout')
      expect(mockUpdateActiveWorkspace).not.toHaveBeenCalled()
      expect(mockToastAdd).not.toHaveBeenCalled()
      expect(mockTrackBillingEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'operation',
          stage: 'timeout',
          billing_op_id: 'op-1',
          operation_type: 'cancel'
        })
      )
    })
  })

  describe('exponential backoff', () => {
    it('uses exponential backoff for polling intervals', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'pending',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'subscription')

      await vi.advanceTimersByTimeAsync(0)
      expect(workspaceApi.getBillingOpStatus).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(1500)
      expect(workspaceApi.getBillingOpStatus).toHaveBeenCalledTimes(2)

      await vi.advanceTimersByTimeAsync(2250)
      expect(workspaceApi.getBillingOpStatus).toHaveBeenCalledTimes(3)
    })

    it('caps polling interval at 8 seconds', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'pending',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'subscription')

      await vi.advanceTimersByTimeAsync(60_000)

      const callCountBefore = vi.mocked(workspaceApi.getBillingOpStatus).mock
        .calls.length

      await vi.advanceTimersByTimeAsync(8000)

      expect(
        vi.mocked(workspaceApi.getBillingOpStatus).mock.calls.length
      ).toBeGreaterThan(callCountBefore)
    })
  })

  describe('network errors', () => {
    it('continues polling on network errors', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          id: 'op-1',
          status: 'succeeded',
          started_at: new Date().toISOString()
        } satisfies BillingOpStatusResponse)

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'subscription')

      await vi.advanceTimersByTimeAsync(0)
      expect(store.getOperation('op-1')?.status).toBe('pending')

      await vi.advanceTimersByTimeAsync(1500)
      expect(store.getOperation('op-1')?.status).toBe('pending')

      await vi.advanceTimersByTimeAsync(2250)
      expect(store.getOperation('op-1')?.status).toBe('succeeded')
    })

    it('keeps an uncertain operation pending through repeated failures', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockRejectedValue(
        new Error('Network error')
      )

      const store = useBillingOperationStore()
      const terminal = store.startOperation('op-1', 'subscription')
      let resolved = false
      void terminal.then(() => {
        resolved = true
      })

      await vi.advanceTimersByTimeAsync(20_000)

      expect(store.getOperation('op-1')?.status).toBe('pending')
      expect(store.hasPendingOperations).toBe(true)
      expect(resolved).toBe(false)
      expect(mockToastAdd).not.toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
    })

    it('polls pending operations immediately when the page becomes visible', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'pending',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'subscription')
      await vi.advanceTimersByTimeAsync(0)
      const pollCount = vi.mocked(workspaceApi.getBillingOpStatus).mock.calls
        .length

      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'visible'
      })
      document.dispatchEvent(new Event('visibilitychange'))
      await vi.advanceTimersByTimeAsync(0)

      expect(
        vi.mocked(workspaceApi.getBillingOpStatus).mock.calls.length
      ).toBeGreaterThan(pollCount)
    })
  })

  describe('clearOperation', () => {
    it('removes operation from the store', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'succeeded',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'subscription')

      await vi.advanceTimersByTimeAsync(0)

      expect(store.operations.size).toBe(1)

      store.clearOperation('op-1')

      expect(store.operations.size).toBe(0)
      expect(store.getOperation('op-1')).toBeUndefined()
    })
  })

  describe('multiple operations', () => {
    it('can track multiple operations concurrently', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockImplementation(
        async (opId: string) => ({
          id: opId,
          status: 'pending' as const,
          started_at: new Date().toISOString()
        })
      )

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'subscription')
      void store.startOperation('op-2', 'topup')

      expect(store.operations.size).toBe(2)
      expect(store.hasPendingOperations).toBe(true)

      vi.mocked(workspaceApi.getBillingOpStatus).mockImplementation(
        async (opId: string) => ({
          id: opId,
          status:
            opId === 'op-1' ? ('succeeded' as const) : ('pending' as const),
          started_at: new Date().toISOString()
        })
      )

      await vi.advanceTimersByTimeAsync(1500)

      expect(store.getOperation('op-1')?.status).toBe('succeeded')
      expect(store.getOperation('op-2')?.status).toBe('pending')
      expect(store.hasPendingOperations).toBe(true)
    })
  })

  describe('isSettingUp', () => {
    it('returns true when there is a pending subscription operation', () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'pending',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'subscription')

      expect(store.isSettingUp).toBe(true)
    })

    it('returns false when there is no pending subscription operation', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'succeeded',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'subscription')

      await vi.advanceTimersByTimeAsync(0)

      expect(store.isSettingUp).toBe(false)
    })

    it('returns false when only topup operations are pending', () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'pending',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'topup')

      expect(store.isSettingUp).toBe(false)
    })
  })

  describe('isAddingCredits', () => {
    it('returns true when there is a pending topup operation', () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'pending',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'topup')

      expect(store.isAddingCredits).toBe(true)
    })

    it('returns false when there is no pending topup operation', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'succeeded',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'topup')

      await vi.advanceTimersByTimeAsync(0)

      expect(store.isAddingCredits).toBe(false)
    })

    it('returns false when only subscription operations are pending', () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'pending',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'subscription')

      expect(store.isAddingCredits).toBe(false)
    })
  })
})
