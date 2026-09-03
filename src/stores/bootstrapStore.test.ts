import type { AxiosResponse } from 'axios'
import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { mergeCustomNodesI18n } from '@/i18n'
import { useSettingStore } from '@/platform/settings/settingStore'
import { bootstrapTracer } from '@/platform/telemetry/perf/bootstrapTracer'
import { api } from '@/scripts/api'

import { useBootstrapStore } from './bootstrapStore'

vi.mock('@/scripts/api', () => ({
  api: {
    init: vi.fn().mockResolvedValue(undefined),
    getNodeDefs: vi.fn().mockResolvedValue({ TestNode: { name: 'TestNode' } }),
    getCustomNodesI18n: vi.fn().mockResolvedValue({}),
    getUserConfig: vi.fn().mockResolvedValue({})
  }
}))

vi.mock('@/i18n', () => ({
  mergeCustomNodesI18n: vi.fn()
}))

const mockIsSettingsReady = ref(false)
const mockSettingLoad = vi.hoisted(() => vi.fn(() => Promise.resolve()))
const mockWorkflowLoad = vi.hoisted(() => vi.fn(() => Promise.resolve()))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: vi.fn(() => ({
    load: mockSettingLoad,
    get isReady() {
      return mockIsSettingsReady.value
    },
    isLoading: ref(false),
    error: ref(undefined)
  }))
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: vi.fn(() => ({
    loadWorkflows: mockWorkflowLoad,
    syncWorkflows: vi.fn().mockResolvedValue(undefined)
  }))
}))

const mockNeedsLogin = ref(false)
vi.mock('@/stores/userStore', () => ({
  useUserStore: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    needsLogin: mockNeedsLogin
  }))
}))

const mockIsAuthInitialized = ref(false)
const mockIsAuthAuthenticated = ref(false)
vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(() => ({
    isInitialized: mockIsAuthInitialized,
    isAuthenticated: mockIsAuthAuthenticated
  }))
}))

const mockDistributionTypes = vi.hoisted(() => ({
  isCloud: false
}))
vi.mock('@/platform/distribution/types', () => mockDistributionTypes)

const mockReportError = vi.hoisted(() => vi.fn())
vi.mock('@/platform/telemetry/reportError', () => ({
  reportError: mockReportError
}))

vi.mock('@sentry/vue', () => ({
  addBreadcrumb: vi.fn()
}))

function requestFailure(status: number) {
  const error = new AxiosError(`Request failed with status code ${status}`)
  error.response = { status } as AxiosResponse
  return error
}

describe('bootstrapStore', () => {
  beforeEach(() => {
    mockIsSettingsReady.value = false
    mockIsAuthInitialized.value = false
    mockIsAuthAuthenticated.value = false
    mockNeedsLogin.value = false
    mockDistributionTypes.isCloud = false
    mockSettingLoad.mockImplementation(() => {
      mockIsSettingsReady.value = true
      return Promise.resolve()
    })
    mockWorkflowLoad.mockResolvedValue(undefined)
  })

  it('initializes with all flags false', () => {
    const store = useBootstrapStore()
    const settingStore = useSettingStore()
    expect(settingStore.isReady).toBe(false)
    expect(store.isI18nReady).toBe(false)
  })

  it('starts store bootstrap (settings, i18n)', async () => {
    const store = useBootstrapStore()
    const settingStore = useSettingStore()
    void store.startStoreBootstrap()

    await vi.waitFor(() => {
      expect(settingStore.isReady).toBe(true)
      expect(store.isI18nReady).toBe(true)
    })
  })

  it('finishes bootstrap when authenticated store loads reject', async () => {
    mockSettingLoad.mockRejectedValueOnce(new Error('settings failed'))
    mockWorkflowLoad.mockRejectedValueOnce(new Error('workflows failed'))
    const milestone = vi.spyOn(bootstrapTracer, 'milestone')
    const logSummary = vi
      .spyOn(bootstrapTracer, 'logSummary')
      .mockImplementation(() => undefined)
    const store = useBootstrapStore()

    await expect(store.startStoreBootstrap()).resolves.toBeUndefined()

    await vi.waitFor(() => {
      expect(milestone).toHaveBeenCalledWith('stores-ready')
      expect(logSummary).toHaveBeenCalledOnce()
      expect(store.isI18nReady).toBe(true)
    })
    expect(milestone.mock.invocationCallOrder[0]).toBeLessThan(
      logSummary.mock.invocationCallOrder[0]
    )
  })

  describe('custom node translations', () => {
    it('treats a missing /api/i18n endpoint as no translations', async () => {
      vi.mocked(api.getCustomNodesI18n).mockRejectedValueOnce(
        requestFailure(404)
      )
      const store = useBootstrapStore()
      void store.startStoreBootstrap()

      await vi.waitFor(() => {
        expect(store.isI18nReady).toBe(true)
      })
      expect(store.i18nError).toBeUndefined()
      expect(mergeCustomNodesI18n).not.toHaveBeenCalled()
    })

    it('surfaces failures other than a missing endpoint', async () => {
      vi.mocked(api.getCustomNodesI18n).mockRejectedValueOnce(
        requestFailure(500)
      )
      const store = useBootstrapStore()
      void store.startStoreBootstrap()

      await vi.waitFor(() => {
        expect(store.i18nError).toBeDefined()
      })
      expect(store.isI18nReady).toBe(false)
    })
  })

  describe('cloud mode', () => {
    beforeEach(() => {
      mockDistributionTypes.isCloud = true
      mockReportError.mockReset()
    })

    it('waits for Firebase init before loading stores, then proceeds regardless of auth state', async () => {
      const store = useBootstrapStore()
      const settingStore = useSettingStore()
      const bootstrapPromise = store.startStoreBootstrap()

      expect(store.isI18nReady).toBe(false)
      expect(settingStore.isReady).toBe(false)

      // Firebase resolves with no user (signed-out) — bootstrap must unblock.
      // Previously it also waited for isAuthenticated, which made every
      // signed-out load wait 35s and fire a false Sentry timeout.
      mockIsAuthInitialized.value = true
      await bootstrapPromise

      await vi.waitFor(() => {
        expect(store.isI18nReady).toBe(true)
        expect(settingStore.isReady).toBe(true)
      })
    })

    it('retries once and proceeds if Firebase init resolves during the backoff', async () => {
      vi.useFakeTimers()
      try {
        const store = useBootstrapStore()
        const settingStore = useSettingStore()
        const bootstrapPromise = store.startStoreBootstrap()

        // First wait times out with Firebase still not initialized.
        await vi.advanceTimersByTimeAsync(16_001)
        expect(settingStore.isReady).toBe(false)

        // Firebase resolves during the retry backoff.
        mockIsAuthInitialized.value = true
        await vi.advanceTimersByTimeAsync(3_001)
        await bootstrapPromise

        expect(settingStore.isReady).toBe(true)
        expect(mockReportError).not.toHaveBeenCalled()
      } finally {
        vi.useRealTimers()
      }
    })

    it('gives up after a second timeout, reports it, and continues bootstrap unauthenticated', async () => {
      vi.useFakeTimers()
      try {
        const store = useBootstrapStore()
        const settingStore = useSettingStore()
        const bootstrapPromise = store.startStoreBootstrap()

        // Firebase never resolves through the initial wait, the backoff, or the retry.
        await vi.advanceTimersByTimeAsync(16_000 + 3_000 + 16_001)
        await bootstrapPromise

        expect(mockReportError).toHaveBeenCalledOnce()
        expect(mockReportError).toHaveBeenCalledWith(expect.anything(), {
          errorType: 'bootstrap_auth_wait_timeout'
        })
        // Bootstrap must not stay stuck: stores load even when Firebase never fires.
        expect(settingStore.isReady).toBe(true)
      } finally {
        vi.useRealTimers()
      }
    })
  })
})
