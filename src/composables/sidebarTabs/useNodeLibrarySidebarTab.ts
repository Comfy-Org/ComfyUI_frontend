import { markRaw } from 'vue'

import NodeLibrarySidebarTab from '@/components/sidebar/tabs/NodeLibrarySidebarTab.vue'
import type { SidebarTabExtension } from '@/types/extensionTypes'

export const useNodeLibrarySidebarTab = (): SidebarTabExtension => {
  return {
    id: 'node-library',
    icon: 'pi pi-book',
    title: 'sideToolbar.nodeLibrary',
    tooltip: 'sideToolbar.nodeLibrary',
    component: markRaw(NodeLibrarySidebarTab),
    type: 'vue'
  }
}
