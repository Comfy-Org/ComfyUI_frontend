import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

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
const mockIsNodeDefsReady = ref(false)
const mockNodeDefStoreLoad = vi.fn(() => {
  mockIsNodeDefsReady.value = true
})
const mockSettingStoreLoad = vi.fn(() => {
  mockIsSettingsReady.value = true
})

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: vi.fn(() => ({
    load: mockSettingStoreLoad,
    isReady: mockIsSettingsReady,
    isLoading: { value: false },
    error: { value: undefined }
  }))
}))

vi.mock('@/stores/nodeDefStore', () => ({
  useNodeDefStore: vi.fn(() => ({
    load: mockNodeDefStoreLoad,
    isReady: mockIsNodeDefsReady,
    isLoading: { value: false },
    error: { value: undefined },
    rawNodeDefs: { value: {} }
  }))
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: vi.fn(() => ({
    loadWorkflows: vi.fn(),
    syncWorkflows: vi.fn().mockResolvedValue(undefined)
  }))
}))

vi.mock('@/stores/userStore', () => ({
  useUserStore: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    needsLogin: false
  }))
}))

describe('bootstrapStore', () => {
  let store: ReturnType<typeof useBootstrapStore>

  beforeEach(() => {
    mockIsSettingsReady.value = false
    mockIsNodeDefsReady.value = false
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useBootstrapStore()
    vi.clearAllMocks()
  })

  it('initializes with all flags false', () => {
    expect(mockIsNodeDefsReady.value).toBe(false)
    expect(mockIsSettingsReady.value).toBe(false)
    expect(store.isI18nReady).toBe(false)
  })

  it('starts early bootstrap (node defs)', async () => {
    store.startEarlyBootstrap()

    await vi.waitFor(() => {
      expect(mockIsNodeDefsReady.value).toBe(true)
    })

    expect(mockNodeDefStoreLoad).toHaveBeenCalled()
  })

  it('starts store bootstrap (settings, i18n)', async () => {
    void store.startStoreBootstrap()

    await vi.waitFor(() => {
      expect(mockIsSettingsReady.value).toBe(true)
      expect(store.isI18nReady).toBe(true)
    })
  })
})
