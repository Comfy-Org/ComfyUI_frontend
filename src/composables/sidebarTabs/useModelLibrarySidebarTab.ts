import { t } from '@/i18n'
import { markRaw } from 'vue'

import ModelLibrarySidebarTab from '@/components/sidebar/tabs/ModelLibrarySidebarTab.vue'
import { isDesktop } from '@/platform/distribution/types'
import { useElectronDownloadStore } from '@/stores/electronDownloadStore'
import type { SidebarTabExtension } from '@/types/extensionTypes'

export const useModelLibrarySidebarTab = (): SidebarTabExtension => {
  return {
    id: 'model-library',
    icon: 'icon-[comfy--ai-model]',
    title: 'sideToolbar.modelLibrary',
    tooltip: 'sideToolbar.modelLibrary',
    label: t('g.sidetoolbar_labels_models'),
    component: markRaw(ModelLibrarySidebarTab),
    type: 'vue',
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
