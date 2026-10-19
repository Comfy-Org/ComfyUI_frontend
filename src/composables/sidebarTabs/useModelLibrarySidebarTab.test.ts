import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useModelLibrarySidebarTab } from '@/composables/sidebarTabs/useModelLibrarySidebarTab'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { openModelLibraryBrowser } from '@/platform/assets/composables/openModelLibraryBrowser'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useSettingStore } from '@/platform/settings/settingStore'

const distribution = vi.hoisted(() => ({ isCloud: true }))
vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return distribution.isCloud
  },
  isDesktop: false
}))

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
  beforeEach(() => {
    distribution.isCloud = true
  })

  it.for([
    {
      name: 'shows Release folders on a picked Cloud deployment',
      useAssetBrowser: true,
      assetsEnabled: true,
      picked: true,
      cloud: true,
      handled: false,
      browserOpens: 0
    },
    {
      name: 'preserves the asset browser outside Cloud',
      useAssetBrowser: true,
      assetsEnabled: true,
      picked: true,
      cloud: false,
      handled: true,
      browserOpens: 1
    },
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
    async ({
      useAssetBrowser,
      assetsEnabled,
      handled,
      browserOpens,
      picked,
      cloud
    }) => {
      useSettingStore().settingValues['Comfy.ModelLibrary.UseAssetBrowser'] =
        useAssetBrowser
      vi.mocked(useFeatureFlags().flags).assetsEnabled = assetsEnabled

      distribution.isCloud = cloud ?? true
      if (picked)
        useDeploymentPickStore().bootDeployment = {
          deployment_id: 'dep-release',
          release_id: 'release-1',
          status: 'ready',
          created_at: '2026-10-01T00:00:00Z'
        }

      const tab = useModelLibrarySidebarTab()

      await expect(tab.onToggle?.()).resolves.toBe(handled)
      expect(openModelLibraryBrowser).toHaveBeenCalledTimes(browserOpens)
    }
  )
})
