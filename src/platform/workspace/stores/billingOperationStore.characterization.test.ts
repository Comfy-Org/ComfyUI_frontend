/**
 * Characterization tests for billingOperationStore.
 *
 * These pin down behavior that exists today but was not covered by
 * billingOperationStore.test.ts. They are deliberately descriptive rather than
 * prescriptive: where current behavior is surprising, the test name says so.
 * They must keep passing across the XState conversion unchanged.
 */
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

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

vi.mock('@/platform/settings/composables/useSettingsDialog', () => ({
  useSettingsDialog: () => ({
    show: vi.fn(),
    hide: vi.fn(),
    showAbout: vi.fn()
  })
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({
    closeDialog: vi.fn()
  })
}))

const mockTrackBillingEvent = vi.fn()

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackBillingEvent: mockTrackBillingEvent
  })
}))

const mockActiveWorkspaceId = ref('workspace-1')

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    get activeWorkspaceId() {
      return mockActiveWorkspaceId.value
    },
    updateActiveWorkspace: vi.fn()
  })
}))

import { workspaceApi } from '@/platform/workspace/api/workspaceApi'

import { useBillingOperationStore } from './billingOperationStore'

const ACTION_URL = 'https://verify.example/sensitive-token'
const MINUTE = 60_000
const HOUR = 60 * MINUTE

function pending(
  overrides: Partial<BillingOpStatusResponse> = {}
): BillingOpStatusResponse {
  return {
    id: 'op-1',
    status: 'pending',
    started_at: new Date().toISOString(),
    ...overrides
  }
}

function statusCallCount() {
  return vi.mocked(workspaceApi.getBillingOpStatus).mock.calls.length
}

describe('billingOperationStore characterization', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockActiveWorkspaceId.value = 'workspace-1'
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('inactive workspace suspends requests but not the clock', () => {
    it('issues no further status requests while the workspace is inactive', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue(pending())

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'subscription')
      mockActiveWorkspaceId.value = 'workspace-2'

      // The first request is already in flight when startOperation returns.
      expect(statusCallCount()).toBe(1)

      await vi.advanceTimersByTimeAsync(60_000)

      expect(statusCallCount()).toBe(1)
      expect(store.getOperation('op-1')?.status).toBe('pending')
    })

    it('resumes requesting once the workspace becomes active again', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue(pending())

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'subscription')
      mockActiveWorkspaceId.value = 'workspace-2'
      await vi.advanceTimersByTimeAsync(60_000)

      const suspendedCalls = statusCallCount()
      mockActiveWorkspaceId.value = 'workspace-1'
      await vi.advanceTimersByTimeAsync(10_000)

      expect(statusCallCount()).toBeGreaterThan(suspendedCalls)
    })

    it('keeps counting an inactive operation toward hasPendingOperations', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue(pending())

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'subscription')
      mockActiveWorkspaceId.value = 'workspace-2'
      await vi.advanceTimersByTimeAsync(10_000)

      // isSettingUp is workspace-scoped, hasPendingOperations is not.
      expect(store.isSettingUp).toBe(false)
      expect(store.hasPendingOperations).toBe(true)
    })
  })

  describe('action-required cadence and budget', () => {
    it('switches from exponential backoff to a flat 30s poll once an action URL is seen', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue(
        pending({ action_url: ACTION_URL })
      )

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'subscription')

      await vi.advanceTimersByTimeAsync(0)
      expect(statusCallCount()).toBe(1)

      // Backoff would have polled at ~1.5s; the action cadence must not.
      await vi.advanceTimersByTimeAsync(29_000)
      expect(statusCallCount()).toBe(1)

      await vi.advanceTimersByTimeAsync(1500)
      expect(statusCallCount()).toBe(2)
    })

    it('survives far past the 5 minute discovery deadline once an action URL is seen', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus)
        .mockResolvedValueOnce(pending({ action_url: ACTION_URL }))
        .mockResolvedValue(pending())

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'subscription')
      await vi.advanceTimersByTimeAsync(0)

      await vi.advanceTimersByTimeAsync(30 * MINUTE)

      expect(store.getOperation('op-1')?.status).toBe('pending')
    })

    it(
      'times out an authenticated subscription only after 23 hours',
      { timeout: 60_000 },
      async () => {
        vi.mocked(workspaceApi.getBillingOpStatus)
          .mockResolvedValueOnce(pending({ action_url: ACTION_URL }))
          .mockResolvedValue(pending())

        const store = useBillingOperationStore()
        void store.startOperation('op-1', 'subscription')
        await vi.advanceTimersByTimeAsync(0)

        await vi.advanceTimersByTimeAsync(22 * HOUR)
        expect(store.getOperation('op-1')?.status).toBe('pending')

        await vi.advanceTimersByTimeAsync(HOUR + MINUTE)
        expect(store.getOperation('op-1')?.status).toBe('timeout')
      }
    )

    it('keeps authenticationRequiredSeen set after the action URL is withdrawn', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus)
        .mockResolvedValueOnce(pending({ action_url: ACTION_URL }))
        .mockResolvedValue(pending())

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'subscription')
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(30_000)

      expect(store.getOperation('op-1')).toMatchObject({
        actionUrl: null,
        authenticationRequiredSeen: true
      })
    })

    it('applies the 30s action cadence to a top-up but still times it out at 2 minutes', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue(
        pending({ action_url: ACTION_URL })
      )

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'topup')
      await vi.advanceTimersByTimeAsync(0)

      expect(store.getOperation('op-1')?.authenticationRequiredSeen).toBe(true)

      // The long authentication budget is subscription-only.
      await vi.advanceTimersByTimeAsync(2 * MINUTE + 30_000)

      expect(store.getOperation('op-1')?.status).toBe('timeout')
    })
  })

  describe('terminal precedence at the deadline', () => {
    it('prefers a failure response that lands after the deadline over a timeout', async () => {
      let resolveStatus!: (response: BillingOpStatusResponse) => void
      vi.mocked(workspaceApi.getBillingOpStatus).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveStatus = resolve
          })
      )

      const store = useBillingOperationStore()
      const terminal = store.startOperation('op-1', 'topup')
      await vi.advanceTimersByTimeAsync(2 * MINUTE + 1)

      resolveStatus({
        id: 'op-1',
        status: 'failed',
        error_message: 'card declined',
        started_at: new Date().toISOString()
      })
      await vi.advanceTimersByTimeAsync(0)

      const operation = await terminal
      expect(operation.status).toBe('failed')
      expect(operation.errorMessage).toBe('card declined')
    })

    it('clears the action URL when an operation ends in failure', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus)
        .mockResolvedValueOnce(pending({ action_url: ACTION_URL }))
        .mockResolvedValue({
          id: 'op-1',
          status: 'failed',
          started_at: new Date().toISOString()
        })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'subscription')
      await vi.advanceTimersByTimeAsync(0)
      expect(store.getOperation('op-1')?.actionUrl).toBe(ACTION_URL)

      await vi.advanceTimersByTimeAsync(30_000)

      expect(store.getOperation('op-1')).toMatchObject({
        status: 'failed',
        actionUrl: null
      })
    })
  })

  describe('processing toast lifecycle', () => {
    it('removes the processing toast on failure', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'failed',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'topup')
      const processingToast = mockToastAdd.mock.calls[0][0]

      await vi.advanceTimersByTimeAsync(0)

      expect(mockToastRemove).toHaveBeenCalledWith(processingToast)
    })

    it('removes the processing toast on timeout', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue(pending())

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'topup')
      const processingToast = mockToastAdd.mock.calls[0][0]

      await vi.advanceTimersByTimeAsync(2 * MINUTE + 10_000)

      expect(mockToastRemove).toHaveBeenCalledWith(processingToast)
    })
  })

  describe('top-up success refreshes balance, subscription success reconciles', () => {
    it('fetches status and balance on top-up success', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue({
        id: 'op-1',
        status: 'succeeded',
        started_at: new Date().toISOString()
      })

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'topup')
      await vi.advanceTimersByTimeAsync(0)

      expect(mockFetchStatus).toHaveBeenCalled()
      expect(mockFetchBalance).toHaveBeenCalled()
      expect(mockReconcileSubscriptionSuccess).not.toHaveBeenCalled()
    })
  })

  describe('clearOperation', () => {
    it('stops polling a pending operation', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus).mockResolvedValue(pending())

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'subscription')
      await vi.advanceTimersByTimeAsync(0)

      store.clearOperation('op-1')
      const callsAtClear = statusCallCount()

      await vi.advanceTimersByTimeAsync(60_000)

      expect(statusCallCount()).toBe(callsAtClear)
    })

    it('leaves a restarted operation untouched by the previous run in-flight response', async () => {
      let resolveStatus!: (response: BillingOpStatusResponse) => void
      vi.mocked(workspaceApi.getBillingOpStatus)
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveStatus = resolve
            })
        )
        .mockResolvedValue(pending())

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'subscription')
      store.clearOperation('op-1')
      void store.startOperation('op-1', 'topup')

      resolveStatus({
        id: 'op-1',
        status: 'succeeded',
        started_at: new Date().toISOString()
      })
      await vi.advanceTimersByTimeAsync(0)

      expect(store.getOperation('op-1')).toMatchObject({
        type: 'topup',
        status: 'pending'
      })
    })
  })

  describe('backoff continuity across network errors', () => {
    it('does not reset the backoff interval after a failed request', async () => {
      vi.mocked(workspaceApi.getBillingOpStatus)
        .mockResolvedValueOnce(pending())
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue(pending())

      const store = useBillingOperationStore()
      void store.startOperation('op-1', 'subscription')

      await vi.advanceTimersByTimeAsync(0)
      expect(statusCallCount()).toBe(1)

      await vi.advanceTimersByTimeAsync(1500)
      expect(statusCallCount()).toBe(2)

      // Backoff continues from 1500 -> 2250 rather than restarting at 1000.
      await vi.advanceTimersByTimeAsync(2249)
      expect(statusCallCount()).toBe(2)

      await vi.advanceTimersByTimeAsync(1)
      expect(statusCallCount()).toBe(3)
    })
  })
})
