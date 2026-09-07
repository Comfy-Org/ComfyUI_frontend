import { nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

const {
  mockGetSetting,
  mockRegisterCommand,
  mockRegisterCommands,
  mockOpenModelLibraryBrowser,
  featureFlagState,
  registeredCommands
} = vi.hoisted(() => {
  const registeredCommands: { id: string; function: () => unknown }[] = []
  return {
    mockGetSetting: vi.fn(),
    mockRegisterCommand: vi.fn((command) => registeredCommands.push(command)),
    mockRegisterCommands: vi.fn(),
    mockOpenModelLibraryBrowser: vi.fn(),
    featureFlagState: { assetsEnabled: false },
    registeredCommands
  }
})

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: mockGetSetting
  })
}))

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: {
      get assetsEnabled() {
        return featureFlagState.assetsEnabled
      }
    }
  })
}))

vi.mock('@/platform/assets/composables/openModelLibraryBrowser', () => ({
  openModelLibraryBrowser: mockOpenModelLibraryBrowser
}))

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({
    registerCommand: mockRegisterCommand
  })
}))

vi.mock('@/stores/menuItemStore', () => ({
  useMenuItemStore: () => ({
    registerCommands: mockRegisterCommands
  })
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => key,
  te: () => false
}))

vi.mock('@/composables/sidebarTabs/useAssetsSidebarTab', () => ({
  useAssetsSidebarTab: () => ({
    id: 'assets',
    title: 'assets',
    type: 'vue',
    component: {}
  })
}))

vi.mock('@/composables/sidebarTabs/useJobHistorySidebarTab', () => ({
  useJobHistorySidebarTab: () => ({
    id: 'job-history',
    title: 'job-history',
    type: 'vue',
    component: {}
  })
}))

vi.mock('@/composables/sidebarTabs/useNodeLibrarySidebarTab', () => ({
  useNodeLibrarySidebarTab: () => ({
    id: 'node-library',
    title: 'node-library',
    type: 'vue',
    component: {}
  })
}))

vi.mock('@/composables/sidebarTabs/useModelLibrarySidebarTab', () => ({
  useModelLibrarySidebarTab: () => ({
    id: 'model-library',
    title: 'model-library',
    type: 'vue',
    component: {}
  })
}))

vi.mock(
  '@/platform/workflow/management/composables/useWorkflowsSidebarTab',
  () => ({
    useWorkflowsSidebarTab: () => ({
      id: 'workflows',
      title: 'workflows',
      type: 'vue',
      component: {}
    })
  })
)

vi.mock('@/platform/workflow/management/composables/useAppsSidebarTab', () => ({
  useAppsSidebarTab: () => ({
    id: 'apps',
    title: 'apps',
    type: 'vue',
    component: {}
  })
}))

describe('useSidebarTabStore', () => {
  beforeEach(() => {
    registeredCommands.length = 0
    featureFlagState.assetsEnabled = false
    mockOpenModelLibraryBrowser.mockClear()
  })

  const toggleModelLibrary = async () => {
    const toggleCommand = registeredCommands.find(
      (command) => command.id === 'Workspace.ToggleSidebarTab.model-library'
    )
    await toggleCommand?.function()
  }

  it('registers the job history tab when QPO V2 is enabled', () => {
    mockGetSetting.mockImplementation((key: string) =>
      key === 'Comfy.Queue.QPOV2' ? true : undefined
    )

    const store = useSidebarTabStore()
    store.registerCoreSidebarTabs()

    expect(store.sidebarTabs.map((tab) => tab.id)).toEqual([
      'job-history',
      'assets',
      'node-library',
      'model-library',
      'workflows',
      'apps'
    ])
    expect(mockRegisterCommand).toHaveBeenCalledTimes(6)
  })

  it('does not register the job history tab when QPO V2 is disabled', () => {
    mockGetSetting.mockImplementation((key: string) =>
      key === 'Comfy.Queue.QPOV2' ? false : undefined
    )

    const store = useSidebarTabStore()
    store.registerCoreSidebarTabs()

    expect(store.sidebarTabs.map((tab) => tab.id)).toEqual([
      'assets',
      'node-library',
      'model-library',
      'workflows',
      'apps'
    ])
    expect(mockRegisterCommand).toHaveBeenCalledTimes(5)
  })

  it('prepends the job history tab when QPO V2 is toggled on', async () => {
    const qpoV2Enabled = ref(false)
    mockGetSetting.mockImplementation((key: string) =>
      key === 'Comfy.Queue.QPOV2' ? qpoV2Enabled.value : undefined
    )

    const store = useSidebarTabStore()
    store.registerCoreSidebarTabs()

    qpoV2Enabled.value = true
    await nextTick()

    expect(store.sidebarTabs.map((tab) => tab.id)).toEqual([
      'job-history',
      'assets',
      'node-library',
      'model-library',
      'workflows',
      'apps'
    ])
    expect(mockRegisterCommand).toHaveBeenCalledTimes(6)
  })

  describe('model library view selection', () => {
    const useAssetBrowserSetting = (enabled: boolean) => {
      mockGetSetting.mockImplementation((key: string) =>
        key === 'Comfy.ModelLibrary.UseAssetBrowser' ? enabled : undefined
      )
    }

    it('toggles the sidebar tab when the asset view is disabled', async () => {
      useAssetBrowserSetting(false)
      featureFlagState.assetsEnabled = true

      const store = useSidebarTabStore()
      store.registerCoreSidebarTabs()

      await toggleModelLibrary()

      expect(store.activeSidebarTabId).toBe('model-library')
      expect(mockOpenModelLibraryBrowser).not.toHaveBeenCalled()
    })

    it('opens the asset browser when the asset view and the assets capability are both enabled', async () => {
      useAssetBrowserSetting(true)
      featureFlagState.assetsEnabled = true

      const store = useSidebarTabStore()
      store.registerCoreSidebarTabs()

      await toggleModelLibrary()

      expect(mockOpenModelLibraryBrowser).toHaveBeenCalledOnce()
      expect(store.activeSidebarTabId).toBeNull()
    })

    it('falls back to the sidebar tree when the assets capability is missing', async () => {
      useAssetBrowserSetting(true)
      featureFlagState.assetsEnabled = false

      const store = useSidebarTabStore()
      store.registerCoreSidebarTabs()

      await toggleModelLibrary()

      expect(store.activeSidebarTabId).toBe('model-library')
      expect(mockOpenModelLibraryBrowser).not.toHaveBeenCalled()
    })
  })
})
