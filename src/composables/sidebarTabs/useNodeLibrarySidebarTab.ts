import { markRaw } from 'vue'

import NodeLibrarySidebarTab from '@/components/sidebar/tabs/NodeLibrarySidebarTab.vue'
import type { SidebarTabExtension } from '@/types/extensionTypes'

export const useNodeLibrarySidebarTab = (): SidebarTabExtension => {
  return {
    id: 'node-library',
    icon: 'icon-[comfy--node]',
    title: 'sideToolbar.nodeLibrary',
    tooltip: 'sideToolbar.nodeLibrary',
    label: 'sideToolbar.labels.nodes',
    component: markRaw(NodeLibrarySidebarTab),
    type: 'vue'
  }
}
