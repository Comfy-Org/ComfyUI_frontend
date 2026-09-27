import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCommandStore } from '@/stores/commandStore'
import { useMenuItemStore } from '@/stores/menuItemStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

const mockOpenModelLibraryBrowser = vi.hoisted(() => vi.fn())

vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(
  import('@/platform/assets/composables/openModelLibraryBrowser'),
  () => ({
    openModelLibraryBrowser: mockOpenModelLibraryBrowser
  })
)

vi.mock(import('@/i18n'), () => ({
  t: (key: string) => key,
  te: () => false
}))

describe('useSidebarTabStore', () => {
  beforeEach(() => {
    vi.mocked(useMenuItemStore().registerCommands).mockImplementation(() => {})
    mockOpenModelLibraryBrowser.mockClear()
  })

  const registerModelLibraryTab = () => {
    const store = useSidebarTabStore()
    store.registerSidebarTab({
      id: 'model-library',
      title: 'model-library',
      type: 'vue',
      component: {}
    })
    return store
  }

  const toggleModelLibrary = async () => {
    const toggleCommand = useCommandStore().commands.find(
      (command) => command.id === 'Workspace.ToggleSidebarTab.model-library'
    )
    await toggleCommand?.function()
  }

  describe('model library view selection', () => {
    const useAssetBrowserSetting = (enabled: boolean) => {
      useSettingStore().settingValues['Comfy.ModelLibrary.UseAssetBrowser'] =
        enabled
    }

    it('toggles the sidebar tab when the asset view is disabled', async () => {
      useAssetBrowserSetting(false)
      vi.mocked(useFeatureFlags().flags).assetsEnabled = true

      const store = registerModelLibraryTab()

      await toggleModelLibrary()

      expect(store.activeSidebarTabId).toBe('model-library')
      expect(mockOpenModelLibraryBrowser).not.toHaveBeenCalled()
    })

    it('opens the asset browser when the asset view and the assets capability are both enabled', async () => {
      useAssetBrowserSetting(true)
      vi.mocked(useFeatureFlags().flags).assetsEnabled = true

      const store = registerModelLibraryTab()

      await toggleModelLibrary()

      expect(mockOpenModelLibraryBrowser).toHaveBeenCalledOnce()
      expect(store.activeSidebarTabId).toBeNull()
    })

    it('falls back to the sidebar tree when the assets capability is missing', async () => {
      useAssetBrowserSetting(true)

      const store = registerModelLibraryTab()

      await toggleModelLibrary()

      expect(store.activeSidebarTabId).toBe('model-library')
      expect(mockOpenModelLibraryBrowser).not.toHaveBeenCalled()
    })
  })
})
