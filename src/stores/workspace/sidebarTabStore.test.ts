import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useCommandStore } from '@/stores/commandStore'
import { useMenuItemStore } from '@/stores/menuItemStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

const { mockOpenModelLibraryBrowser, featureFlagState } = vi.hoisted(() => ({
  mockOpenModelLibraryBrowser: vi.fn(),
  featureFlagState: { assetsEnabled: false }
}))

vi.mock<unknown>(import('@/composables/useFeatureFlags'), () => ({
  useFeatureFlags: () => ({
    flags: {
      get assetsEnabled() {
        return featureFlagState.assetsEnabled
      }
    }
  })
}))

vi.mock<unknown>(
  import('@/platform/assets/composables/openModelLibraryBrowser'),
  () => ({
    openModelLibraryBrowser: mockOpenModelLibraryBrowser
  })
)

vi.mock(import('@/i18n'), () => ({
  t: (key: string) => key,
  te: () => false
}))

vi.mock(import('@/composables/sidebarTabs/useAssetsSidebarTab'), () => ({
  useAssetsSidebarTab: () => ({
    id: 'assets',
    title: 'assets',
    type: 'vue',
    component: {}
  })
}))

vi.mock(import('@/composables/sidebarTabs/useJobHistorySidebarTab'), () => ({
  useJobHistorySidebarTab: () => ({
    id: 'job-history',
    title: 'job-history',
    type: 'vue',
    component: {}
  })
}))

vi.mock(import('@/composables/sidebarTabs/useNodeLibrarySidebarTab'), () => ({
  useNodeLibrarySidebarTab: () => ({
    id: 'node-library',
    title: 'node-library',
    type: 'vue',
    component: {}
  })
}))

vi.mock(import('@/composables/sidebarTabs/useModelLibrarySidebarTab'), () => ({
  useModelLibrarySidebarTab: () => ({
    id: 'model-library',
    title: 'model-library',
    type: 'vue',
    component: {}
  })
}))

vi.mock(
  import('@/platform/workflow/management/composables/useWorkflowsSidebarTab'),
  () => ({
    useWorkflowsSidebarTab: () => ({
      id: 'workflows',
      title: 'workflows',
      type: 'vue',
      component: {}
    })
  })
)

vi.mock(
  import('@/platform/workflow/management/composables/useAppsSidebarTab'),
  () => ({
    useAppsSidebarTab: () => ({
      id: 'apps',
      title: 'apps',
      type: 'vue',
      component: {}
    })
  })
)

describe('useSidebarTabStore', () => {
  beforeEach(() => {
    vi.mocked(useMenuItemStore().registerCommands).mockImplementation(() => {})
    featureFlagState.assetsEnabled = false
    mockOpenModelLibraryBrowser.mockClear()
  })

  const toggleModelLibrary = async () => {
    const toggleCommand = useCommandStore().commands.find(
      (command) => command.id === 'Workspace.ToggleSidebarTab.model-library'
    )
    await toggleCommand?.function()
  }

  it('registers the job history tab when QPO V2 is enabled', () => {
    useSettingStore().settingValues['Comfy.Queue.QPOV2'] = true

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
    expect(useCommandStore().registerCommand).toHaveBeenCalledTimes(6)
  })

  it('does not register the job history tab when QPO V2 is disabled', () => {
    useSettingStore().settingValues['Comfy.Queue.QPOV2'] = false

    const store = useSidebarTabStore()
    store.registerCoreSidebarTabs()

    expect(store.sidebarTabs.map((tab) => tab.id)).toEqual([
      'assets',
      'node-library',
      'model-library',
      'workflows',
      'apps'
    ])
    expect(useCommandStore().registerCommand).toHaveBeenCalledTimes(5)
  })

  it('prepends the job history tab when QPO V2 is toggled on', async () => {
    useSettingStore().settingValues['Comfy.Queue.QPOV2'] = false

    const store = useSidebarTabStore()
    store.registerCoreSidebarTabs()

    useSettingStore().settingValues['Comfy.Queue.QPOV2'] = true
    await nextTick()

    expect(store.sidebarTabs.map((tab) => tab.id)).toEqual([
      'job-history',
      'assets',
      'node-library',
      'model-library',
      'workflows',
      'apps'
    ])
    expect(useCommandStore().registerCommand).toHaveBeenCalledTimes(6)
  })

  describe('model library view selection', () => {
    const useAssetBrowserSetting = (enabled: boolean) => {
      useSettingStore().settingValues['Comfy.ModelLibrary.UseAssetBrowser'] =
        enabled
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
