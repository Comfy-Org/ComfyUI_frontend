import { markRaw } from 'vue'
import { useI18n } from 'vue-i18n'

import ModelLibrarySidebarTab from '@/components/sidebar/tabs/ModelLibrarySidebarTab.vue'
import { useElectronDownloadStore } from '@/stores/electronDownloadStore'
import type { SidebarTabExtension } from '@/types/extensionTypes'
import { isElectron } from '@/utils/envUtil'

export const useModelLibrarySidebarTab = (): SidebarTabExtension => {
  const { t } = useI18n()

  return {
    id: 'model-library',
    icon: 'pi pi-box',
    title: t('sideToolbar.modelLibrary'),
    tooltip: t('sideToolbar.modelLibrary'),
    component: markRaw(ModelLibrarySidebarTab),
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
