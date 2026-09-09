import { useAuthStore } from '@/stores/authStore'
import { useUserStore } from '@/stores/userStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { AxiosResponse } from 'axios'
import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { mergeCustomNodesI18n } from '@/i18n'
import { useSettingStore } from '@/platform/settings/settingStore'
import { bootstrapTracer } from '@/platform/telemetry/perf/bootstrapTracer'
import { api } from '@/scripts/api'

import { useBootstrapStore } from './bootstrapStore'

vi.mock(import('firebase/auth'))
vi.mock(import('@/scripts/api'), async (importOriginal) => {
  const actual = await importOriginal()
  Object.assign(actual.api, {
    init: vi.fn().mockResolvedValue(undefined),
    getNodeDefs: vi.fn().mockResolvedValue({ TestNode: { name: 'TestNode' } }),
    getCustomNodesI18n: vi.fn().mockResolvedValue({}),
    getUserConfig: vi.fn().mockResolvedValue({})
  })
  return actual
})

vi.mock(import('@/i18n'), async (importOriginal) => ({
  ...(await importOriginal()),
  mergeCustomNodesI18n: vi.fn()
}))

const mockDistributionTypes = vi.hoisted(() => ({
  isCloud: false
}))
vi.mock(import('@/platform/distribution/types'), () => mockDistributionTypes)

const mockReportError = vi.hoisted(() => vi.fn())
vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: mockReportError
}))

vi.mock(import('@sentry/vue'), () => ({
  addBreadcrumb: vi.fn()
}))

function requestFailure(status: number) {
  const error = new AxiosError(`Request failed with status code ${status}`)
  error.response = { status } as AxiosResponse
  return error
}

describe('bootstrapStore', () => {
  beforeEach(() => {
    useSettingStore().isReady = false
    useAuthStore().isInitialized = false
    Object.assign(useAuthStore(), { isAuthenticated: false })
    Object.assign(useUserStore(), { needsLogin: false })
    mockDistributionTypes.isCloud = false
    vi.mocked(useSettingStore().load).mockImplementation(() => {
      useSettingStore().isReady = true
      return Promise.resolve()
    })
    vi.mocked(useWorkflowStore().loadWorkflows).mockResolvedValue(undefined)
    vi.mocked(useWorkflowStore().syncWorkflows).mockResolvedValue(undefined)
    vi.mocked(useUserStore().initialize).mockResolvedValue(undefined)
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

  it('records both store phases when their loads reject', async () => {
    vi.mocked(useSettingStore().load).mockRejectedValueOnce(
      new Error('settings failed')
    )
    vi.mocked(useWorkflowStore().loadWorkflows).mockRejectedValueOnce(
      new Error('workflows failed')
    )
    const milestone = vi.spyOn(bootstrapTracer, 'milestone')
    const previousPhaseCount = bootstrapTracer.summary().length
    const store = useBootstrapStore()

    await expect(store.startStoreBootstrap()).resolves.toBeUndefined()

    await vi.waitFor(() => {
      expect(milestone).toHaveBeenCalledWith('stores-ready')
      expect(store.isI18nReady).toBe(true)
    })
    const phaseRows = bootstrapTracer.summary().slice(previousPhaseCount)
    expect(phaseRows.map((row) => row.name)).toEqual(
      expect.arrayContaining(['bootstrap/settings', 'bootstrap/workflows'])
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
      useAuthStore().isInitialized = true
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
        useAuthStore().isInitialized = true
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
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})
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
        expect(consoleError).not.toHaveBeenCalled()
        // Bootstrap must not stay stuck: stores load even when Firebase never fires.
        expect(settingStore.isReady).toBe(true)
      } finally {
        vi.useRealTimers()
      }
    })
  })
})
