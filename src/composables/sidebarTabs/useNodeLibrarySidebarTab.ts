import { markRaw } from 'vue'
import { useI18n } from 'vue-i18n'

import NodeLibrarySidebarTab from '@/components/sidebar/tabs/NodeLibrarySidebarTab.vue'
import type { SidebarTabExtension } from '@/types/extensionTypes'

export const useNodeLibrarySidebarTab = (): SidebarTabExtension => {
  const { t } = useI18n()
  return {
    id: 'node-library',
    icon: 'pi pi-book',
    title: t('sideToolbar.nodeLibrary'),
    tooltip: t('sideToolbar.nodeLibrary'),
    component: markRaw(NodeLibrarySidebarTab),
    type: 'vue'
  }
}
