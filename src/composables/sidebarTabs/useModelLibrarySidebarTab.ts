import { defineAsyncComponent } from 'vue'

import { useElectronDownloadStore } from '@/stores/electronDownloadStore'
import type { SidebarTabExtension } from '@/types/extensionTypes'
import { isElectron } from '@/utils/envUtil'

const ModelLibrarySidebarTab = defineAsyncComponent(
  () => import('@/components/sidebar/tabs/ModelLibrarySidebarTab.vue')
)

export const useModelLibrarySidebarTab = (): SidebarTabExtension => {
  return {
    id: 'model-library',
    icon: 'icon-[comfy--ai-model]',
    title: 'sideToolbar.modelLibrary',
    tooltip: 'sideToolbar.modelLibrary',
    label: 'sideToolbar.labels.models',
    component: ModelLibrarySidebarTab,
    type: 'vue',
    iconBadge: () => {
      if (isElectron()) {
        const electronDownloadStore = useElectronDownloadStore()
        if (electronDownloadStore.inProgressDownloads.length > 0) {
          return electronDownloadStore.inProgressDownloads.length.toString()
        }
      }

      return null
    }
  }
}
