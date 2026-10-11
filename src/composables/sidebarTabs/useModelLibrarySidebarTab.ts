import { markRaw } from 'vue'

import ModelLibrarySidebarTab from '@/components/sidebar/tabs/ModelLibrarySidebarTab.vue'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { openModelLibraryBrowser } from '@/platform/assets/composables/openModelLibraryBrowser'
import { isDesktop } from '@/platform/distribution/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useElectronDownloadStore } from '@/stores/electronDownloadStore'
import type { SidebarTabExtension } from '@/types/extensionTypes'

export const useModelLibrarySidebarTab = (): SidebarTabExtension => {
  return {
    id: 'model-library',
    icon: 'icon-[comfy--ai-model]',
    title: 'sideToolbar.modelLibrary',
    tooltip: 'sideToolbar.modelLibrary',
    label: 'sideToolbar.labels.models',
    component: markRaw(ModelLibrarySidebarTab),
    type: 'vue',
    onToggle: async () => {
      const useAssetBrowser =
        useSettingStore().get('Comfy.ModelLibrary.UseAssetBrowser') &&
        useFeatureFlags().flags.assetsEnabled
      if (!useAssetBrowser) return false
      await openModelLibraryBrowser()
      return true
    },
    iconBadge: () => {
      if (isDesktop) {
        const electronDownloadStore = useElectronDownloadStore()
        if (electronDownloadStore.inProgressDownloads.length > 0) {
          return electronDownloadStore.inProgressDownloads.length.toString()
        }
      }

      return null
    }
  }
}
