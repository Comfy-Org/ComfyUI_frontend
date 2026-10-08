import { describe, expect, it, vi } from 'vitest'

import { useModelLibrarySidebarTab } from '@/composables/sidebarTabs/useModelLibrarySidebarTab'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { openModelLibraryBrowser } from '@/platform/assets/composables/openModelLibraryBrowser'
import { useSettingStore } from '@/platform/settings/settingStore'

vi.mock<unknown>(
  import('@/components/sidebar/tabs/ModelLibrarySidebarTab.vue'),
  () => ({
    default: {}
  })
)
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(
  import('@/platform/assets/composables/openModelLibraryBrowser'),
  () => ({
    openModelLibraryBrowser: vi.fn()
  })
)

describe('useModelLibrarySidebarTab', () => {
  it.for([
    {
      name: 'opens the asset browser when the asset view and the assets capability are both enabled',
      useAssetBrowser: true,
      assetsEnabled: true,
      handled: true,
      browserOpens: 1
    },
    {
      name: 'toggles the sidebar tab when the asset view is disabled',
      useAssetBrowser: false,
      assetsEnabled: true,
      handled: false,
      browserOpens: 0
    },
    {
      name: 'falls back to the sidebar tree when the assets capability is missing',
      useAssetBrowser: true,
      assetsEnabled: false,
      handled: false,
      browserOpens: 0
    }
  ])(
    '$name',
    async ({ useAssetBrowser, assetsEnabled, handled, browserOpens }) => {
      useSettingStore().settingValues['Comfy.ModelLibrary.UseAssetBrowser'] =
        useAssetBrowser
      vi.mocked(useFeatureFlags().flags).assetsEnabled = assetsEnabled

      const tab = useModelLibrarySidebarTab()

      await expect(tab.onToggle?.()).resolves.toBe(handled)
      expect(openModelLibraryBrowser).toHaveBeenCalledTimes(browserOpens)
    }
  )
})
