import { markRaw } from 'vue'
import { useI18n } from 'vue-i18n'
import ModelLibrarySidebarTab from '@/components/sidebar/tabs/ModelLibrarySidebarTab.vue'
import type { SidebarTabExtension } from '@/types/extensionTypes'
import { useElectronDownloadStore } from '@/stores/electronDownloadStore'

export const useModelLibrarySidebarTab = (): SidebarTabExtension => {
  const { t } = useI18n()
  const electronDownloadStore = useElectronDownloadStore()

  return {
    id: 'model-library',
    icon: 'pi pi-box',
    title: t('sideToolbar.modelLibrary'),
    tooltip: t('sideToolbar.modelLibrary'),
    component: markRaw(ModelLibrarySidebarTab),
    type: 'vue',
    iconBadge: () => {
      if (electronDownloadStore.downloads.length > 0) {
        return electronDownloadStore.downloads.length.toString()
      }

      return null
    }
  }
}
