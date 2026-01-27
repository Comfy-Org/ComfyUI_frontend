import { defineAsyncComponent } from 'vue'

import type { SidebarTabExtension } from '@/types/extensionTypes'

const NodeLibrarySidebarTab = defineAsyncComponent(
  () => import('@/components/sidebar/tabs/NodeLibrarySidebarTab.vue')
)

export const useNodeLibrarySidebarTab = (): SidebarTabExtension => {
  return {
    id: 'node-library',
    icon: 'icon-[comfy--node]',
    title: 'sideToolbar.nodeLibrary',
    tooltip: 'sideToolbar.nodeLibrary',
    label: 'sideToolbar.labels.nodes',
    component: NodeLibrarySidebarTab,
    type: 'vue'
  }
}
