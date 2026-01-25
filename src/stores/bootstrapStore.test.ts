import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: vi.fn(() => ({
    loadSettingValues: vi.fn().mockResolvedValue(undefined)
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
    setActivePinia(createPinia())
    store = useBootstrapStore()
    vi.clearAllMocks()
  })

  it('initializes with all flags false', () => {
    expect(store.isNodeDefsReady).toBe(false)
    expect(store.isSettingsReady).toBe(false)
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
    void store.startStoreBootstrap()

    await vi.waitFor(() => {
      expect(store.isSettingsReady).toBe(true)
      expect(store.isI18nReady).toBe(true)
    })
  })
})
