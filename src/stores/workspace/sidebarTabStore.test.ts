import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useCommandStore } from '@/stores/commandStore'
import { useMenuItemStore } from '@/stores/menuItemStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

const mockBrowseModelAssets = vi.fn()

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
    it('toggles the sidebar tab when the asset view is disabled', async () => {
      useSettingStore().settingValues['Comfy.ModelLibrary.UseAssetBrowser'] =
        false
      useCommandStore().registerCommand({
        id: 'Comfy.BrowseModelAssets',
        function: mockBrowseModelAssets
      })

      const store = useSidebarTabStore()
      store.registerCoreSidebarTabs()

      await toggleModelLibrary()

      expect(store.activeSidebarTabId).toBe('model-library')
      expect(mockBrowseModelAssets).not.toHaveBeenCalled()
    })

    it('opens the asset browser when the browser and asset API are enabled', async () => {
      useSettingStore().settingValues['Comfy.ModelLibrary.UseAssetBrowser'] =
        true
      useSettingStore().settingValues['Comfy.Assets.UseAssetAPI'] = true
      useCommandStore().registerCommand({
        id: 'Comfy.BrowseModelAssets',
        function: mockBrowseModelAssets
      })

      const store = useSidebarTabStore()
      store.registerCoreSidebarTabs()

      await toggleModelLibrary()

      expect(mockBrowseModelAssets).toHaveBeenCalledOnce()
      expect(store.activeSidebarTabId).toBeNull()
    })

    it('falls back to the sidebar tree when the asset API is disabled', async () => {
      useSettingStore().settingValues['Comfy.ModelLibrary.UseAssetBrowser'] =
        true
      useSettingStore().settingValues['Comfy.Assets.UseAssetAPI'] = false
      useCommandStore().registerCommand({
        id: 'Comfy.BrowseModelAssets',
        function: mockBrowseModelAssets
      })

      const store = useSidebarTabStore()
      store.registerCoreSidebarTabs()

      await toggleModelLibrary()

      expect(store.activeSidebarTabId).toBe('model-library')
      expect(mockBrowseModelAssets).not.toHaveBeenCalled()
    })
  })
})
