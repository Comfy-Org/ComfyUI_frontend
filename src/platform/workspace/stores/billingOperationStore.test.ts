import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'

import type { BillingOpStatusResponse } from '@/platform/workspace/api/workspaceApi'

const mockFetchStatus = vi.fn()
const mockFetchBalance = vi.fn()
const mockReconcileSubscriptionSuccess = vi.fn()

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    fetchStatus: mockFetchStatus,
    fetchBalance: mockFetchBalance,
    reconcileSubscriptionSuccess: mockReconcileSubscriptionSuccess
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

const mockTrackMonthlySubscriptionSucceeded = vi.fn()

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackMonthlySubscriptionSucceeded: mockTrackMonthlySubscriptionSucceeded
  })
}))

const mockUpdateActiveWorkspace = vi.fn()

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    updateActiveWorkspace: mockUpdateActiveWorkspace
  })
}))

import { workspaceApi } from '@/platform/workspace/api/workspaceApi'

import { useBillingOperationStore } from './billingOperationStore'

describe('billingOperationStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useFakeTimers()
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
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

    it('persists recovery context before navigating to a hosted invoice', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-hosted',
        status: 'pending',
        customer_action: {
          type: 'pay_hosted_invoice',
          url: 'https://invoice.test/bearer-token'
        },
        started_at: new Date().toISOString()
      })
      const assignSpy = vi
        .spyOn(globalThis.location, 'assign')
        .mockImplementation(() => {})

      const store = useBillingOperationStore()
      void store.startOperation('op-hosted', 'subscription', {
        hostedInvoiceReturnUrl: globalThis.location.href
      })
      await vi.advanceTimersByTimeAsync(0)

      expect(assignSpy).toHaveBeenCalledWith(
        'https://invoice.test/bearer-token'
      )
      expect(store.getOperation('op-hosted')).toMatchObject({
        status: 'pending',
        paymentNavigationStarted: true
      })
      const persisted = localStorage.getItem('comfy.billing.pending_operation')
      expect(persisted).toContain('op-hosted')
      expect(persisted).toContain(globalThis.location.href)
      expect(persisted).not.toContain('bearer-token')
    })

    it('resumes a hosted invoice operation after browser return', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus)
        .mockResolvedValueOnce({
          id: 'op-return',
          status: 'pending',
          started_at: new Date().toISOString()
        })
        .mockResolvedValueOnce({
          id: 'op-return',
          status: 'pending',
          customer_action: {
            type: 'pay_hosted_invoice',
            url: 'https://invoice.test/bearer-token'
          },
          started_at: new Date().toISOString()
        })
        .mockResolvedValueOnce({
          id: 'op-return',
          status: 'succeeded',
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString()
        })
      vi.spyOn(globalThis.location, 'assign').mockImplementation(() => {})

      const store = useBillingOperationStore()
      const terminal = store.startOperation('op-return', 'subscription', {
        hostedInvoiceReturnUrl: globalThis.location.href
      })
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(1500)

      store.resumePendingOperations()
      await vi.advanceTimersByTimeAsync(0)

      await expect(terminal).resolves.toMatchObject({ status: 'succeeded' })
      expect(localStorage.getItem('comfy.billing.pending_operation')).toBeNull()
    })

    it('does not navigate when recovery context cannot be persisted', async () => {
      const setItemSpy = vi
        .spyOn(globalThis.localStorage, 'setItem')
        .mockImplementation(() => {
          throw new Error('storage unavailable')
        })
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-storage-failure',
        status: 'pending',
        customer_action: {
          type: 'pay_hosted_invoice',
          url: 'https://invoice.test/bearer-token'
        },
        started_at: new Date().toISOString()
      })
      const assignSpy = vi.spyOn(globalThis.location, 'assign')

      const store = useBillingOperationStore()
      void store.startOperation('op-storage-failure', 'subscription', {
        hostedInvoiceReturnUrl: globalThis.location.href
      })
      await vi.advanceTimersByTimeAsync(0)

      expect(assignSpy).not.toHaveBeenCalled()
      expect(store.getOperation('op-storage-failure')).toMatchObject({
        status: 'failed'
      })
      setItemSpy.mockRestore()
    })

    it('does not navigate a topup operation carrying a customer action', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus)
        .mockResolvedValueOnce({
          id: 'op-topup-action',
          status: 'pending',
          customer_action: {
            type: 'pay_hosted_invoice',
            url: 'https://invoice.test/bearer-token'
          },
          started_at: new Date().toISOString()
        })
        .mockResolvedValueOnce({
          id: 'op-topup-action',
          status: 'succeeded',
          started_at: new Date().toISOString()
        })
      const assignSpy = vi.spyOn(globalThis.location, 'assign')

      const store = useBillingOperationStore()
      const terminal = store.startOperation('op-topup-action', 'topup')
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(1500)

      await expect(terminal).resolves.toMatchObject({ status: 'succeeded' })
      expect(assignSpy).not.toHaveBeenCalled()
    })

    it('recovers a persisted operation after reload without reusing its URL', async () => {
      localStorage.setItem(
        'comfy.billing.pending_operation',
        JSON.stringify({
          opId: 'op-reload',
          type: 'subscription',
          startedAt: Date.now() - 300_000,
          returnUrl: globalThis.location.href,
          paymentNavigationStarted: true
        })
      )
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-reload',
        status: 'succeeded',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      })
      const assignSpy = vi.spyOn(globalThis.location, 'assign')

      const store = useBillingOperationStore()
      await vi.advanceTimersByTimeAsync(0)

      expect(store.getOperation('op-reload')).toMatchObject({
        status: 'succeeded'
      })
      expect(assignSpy).not.toHaveBeenCalled()
      expect(localStorage.getItem('comfy.billing.pending_operation')).toBeNull()
    })

    it('coalesces reload and pageshow recovery polling', async () => {
      localStorage.setItem(
        'comfy.billing.pending_operation',
        JSON.stringify({
          opId: 'op-single-flight',
          type: 'subscription',
          startedAt: Date.now(),
          returnUrl: globalThis.location.href,
          paymentNavigationStarted: true
        })
      )
      let resolveStatus!: (value: BillingOpStatusResponse) => void
      vi.mocked(workspaceApi.getBillingOpStatus).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveStatus = resolve
          })
      )

      const store = useBillingOperationStore()
      store.resumePendingOperations()

      expect(workspaceApi.getBillingOpStatus).toHaveBeenCalledOnce()
      resolveStatus({
        id: 'op-single-flight',
        status: 'succeeded',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      })
      await vi.advanceTimersByTimeAsync(0)

      expect(mockTrackMonthlySubscriptionSucceeded).toHaveBeenCalledOnce()
      expect(mockReconcileSubscriptionSuccess).toHaveBeenCalledOnce()
    })
  })

  describe('polling success', () => {
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

    it('fires purchase telemetry on subscription success', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'succeeded',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'subscription')

      await vi.advanceTimersByTimeAsync(0)

      expect(mockTrackMonthlySubscriptionSucceeded).toHaveBeenCalledOnce()
    })

    it('does not fire purchase telemetry on topup success', async () => {
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
    it('updates status and shows error toast on failure', async () => {
      const errorMessage = 'Payment declined'
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'failed',
        error_message: errorMessage,
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'subscription')

      await vi.advanceTimersByTimeAsync(0)

      const operation = store.getOperation('op-1')
      expect(operation?.status).toBe('failed')
      expect(operation?.errorMessage).toBe(errorMessage)
      expect(store.hasPendingOperations).toBe(false)

      expect(mockToastAdd).toHaveBeenCalledWith({
        severity: 'error',
        summary: 'billingOperation.subscriptionFailed',
        detail: errorMessage
      })
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
        detail: undefined
      })
    })
  })

  describe('polling timeout', () => {
    it('times out after 2 minutes and shows error toast', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'pending',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'subscription')

      await vi.advanceTimersByTimeAsync(0)

      await vi.advanceTimersByTimeAsync(121_000)
      await vi.runAllTimersAsync()

      const operation = store.getOperation('op-1')
      expect(operation?.status).toBe('timeout')
      expect(store.hasPendingOperations).toBe(false)

      expect(mockToastAdd).toHaveBeenCalledWith({
        severity: 'error',
        summary: 'billingOperation.subscriptionTimeout'
      })
    })

    it('shows topup timeout message for topup operations', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'pending',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'topup')

      await vi.advanceTimersByTimeAsync(121_000)
      await vi.runAllTimersAsync()

      expect(mockToastAdd).toHaveBeenCalledWith({
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
    })

    it('resolves with a timeout operation after 2 minutes, no toast', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'pending',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      const terminal = store.startOperation('op-1', 'cancel')

      await vi.advanceTimersByTimeAsync(121_000)
      await vi.runAllTimersAsync()
      const operation = await terminal

      expect(operation.status).toBe('timeout')
      expect(operation.errorMessage).toBe('billingOperation.cancelTimeout')
      expect(mockUpdateActiveWorkspace).not.toHaveBeenCalled()
      expect(mockToastAdd).not.toHaveBeenCalled()
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
