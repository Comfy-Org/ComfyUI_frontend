import { markRaw } from 'vue'
import { useI18n } from 'vue-i18n'

import OutputExplorerSidebarTab from '@/components/sidebar/tabs/OutputExplorerSidebarTab.vue'
import type { SidebarTabExtension } from '@/types/extensionTypes'

export const useOutputExplorerSidebarTab = (): SidebarTabExtension => {
  const { t } = useI18n()

  return {
    id: 'output-explorer',
    icon: 'pi pi-image',
    title: t('sideToolbar.outputExplorer'),
    tooltip: t('sideToolbar.outputExplorer'),
    component: markRaw(OutputExplorerSidebarTab),
    type: 'vue'
  }
}
