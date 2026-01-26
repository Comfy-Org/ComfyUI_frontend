import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'

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

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: vi.fn(() => ({
    load: vi.fn(() => {
      mockIsSettingsReady.value = true
    }),
    isReady: mockIsSettingsReady,
    isLoading: ref(false),
    error: ref(undefined)
  }))
}))

vi.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: vi.fn(() => ({
    workflow: {
      syncWorkflows: vi.fn().mockResolvedValue(undefined)
    }
  }))
}))

describe('bootstrapStore', () => {
  let store: ReturnType<typeof useBootstrapStore>

  beforeEach(() => {
    mockIsSettingsReady.value = false
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useBootstrapStore()
    vi.clearAllMocks()
  })

  it('initializes with all flags false', () => {
    const settingStore = useSettingStore()
    expect(store.isNodeDefsReady).toBe(false)
    expect(settingStore.isReady).toBe(false)
    expect(store.isI18nReady).toBe(false)
  })

  it('starts early bootstrap (node defs)', async () => {
    const { api } = await import('@/scripts/api')

    store.startEarlyBootstrap()

    await vi.waitFor(() => {
      expect(store.isNodeDefsReady).toBe(true)
    })

    expect(api.getNodeDefs).toHaveBeenCalled()
  })

  it('starts store bootstrap (settings, i18n)', async () => {
    const settingStore = useSettingStore()
    void store.startStoreBootstrap()

    await vi.waitFor(() => {
      expect(settingStore.isReady).toBe(true)
      expect(store.isI18nReady).toBe(true)
    })
  })
})
