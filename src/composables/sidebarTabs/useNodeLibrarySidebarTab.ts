import { defineAsyncComponent, markRaw } from 'vue'

import NodeLibrarySidebarTab from '@/components/sidebar/tabs/NodeLibrarySidebarTab.vue'
import type { SidebarTabExtension } from '@/types/extensionTypes'

const NodeIcon = markRaw(
  defineAsyncComponent(() => import('virtual:icons/comfy/node'))
)

export const useNodeLibrarySidebarTab = (): SidebarTabExtension => {
  return {
    id: 'node-library',
    icon: NodeIcon,
    title: 'sideToolbar.nodeLibrary',
    tooltip: 'sideToolbar.nodeLibrary',
    label: 'sideToolbar.labels.nodes',
    component: markRaw(NodeLibrarySidebarTab),
    type: 'vue'
  }
}
