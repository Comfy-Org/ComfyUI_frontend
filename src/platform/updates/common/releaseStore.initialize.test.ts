import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { api } from '@/scripts/api'
import { useReleaseService } from '@/platform/updates/common/releaseService'
import { useReleaseStore } from '@/platform/updates/common/releaseStore'
import { createTestingPinia } from '@pinia/testing'
import type { SystemStats } from '@/types'

// Unlike releaseStore.test.ts, this file does NOT mock '@vueuse/core', so the
// real `until` runs and the server-feature-flag gate in initialize() is
// genuinely exercised (regression coverage for the default-off fix).

const mockData = vi.hoisted(() => ({ isCloud: false }))

vi.mock('@/platform/distribution/types', () => ({
  isDesktop: false,
  get isCloud() {
    return mockData.isCloud
  }
}))

vi.mock('@/platform/updates/common/releaseService', async () => {
  const { ref } = await import('vue')
  const getReleases = vi.fn()
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  return {
    useReleaseService: () => ({ getReleases, isLoading, error })
  }
})

vi.mock('@/scripts/api', async () => {
  const { ref } = await import('vue')
  return {
    api: { serverFeatureFlags: ref<Record<string, unknown>>({}) }
  }
})

vi.mock('@/platform/settings/settingStore', () => {
  const get = vi.fn((key: string) => {
    if (key === 'Comfy.Notification.ShowVersionUpdates') return true
    return null
  })
  return {
    useSettingStore: () => ({ get, set: vi.fn(), setMany: vi.fn() })
  }
})

vi.mock('@/stores/systemStatsStore', () => {
  const systemStats: { system: Partial<SystemStats['system']> } = {
    system: { comfyui_version: '1.0.0', argv: [] }
  }
  return {
    useSystemStatsStore: () => ({
      systemStats,
      isInitialized: true,
      getFormFactor: vi.fn(() => 'git-windows')
    })
  }
})

describe('useReleaseStore initialize gating', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
    api.serverFeatureFlags.value = {}
    mockData.isCloud = false
    vi.mocked(useReleaseService().getReleases).mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('waits for server feature flags before fetching releases', async () => {
    const store = useReleaseStore()
    const releaseService = useReleaseService()

    const initializePromise = store.initialize()
    await nextTick()
    await Promise.resolve()

    expect(releaseService.getReleases).not.toHaveBeenCalled()

    api.serverFeatureFlags.value = { show_version_updates: true }
    await initializePromise

    expect(releaseService.getReleases).toHaveBeenCalledTimes(1)
  })

  it('falls back to fetching after the timeout when flags never arrive', async () => {
    vi.useFakeTimers()
    const store = useReleaseStore()
    const releaseService = useReleaseService()

    const initializePromise = store.initialize()
    await Promise.resolve()

    expect(releaseService.getReleases).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(3000)
    await initializePromise

    expect(releaseService.getReleases).toHaveBeenCalledTimes(1)
  })

  it('does not gate on feature flags for cloud installs', async () => {
    mockData.isCloud = true
    const store = useReleaseStore()
    const releaseService = useReleaseService()

    await store.initialize()

    expect(releaseService.getReleases).toHaveBeenCalledTimes(1)
  })
})
