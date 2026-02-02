import { markRaw } from 'vue'

import NodeLibrarySidebarTab from '@/components/sidebar/tabs/NodeLibrarySidebarTab.vue'
import NodeLibrarySidebarTabV2 from '@/components/sidebar/tabs/NodeLibrarySidebarTabV2.vue'
import type { SidebarTabExtension } from '@/types/extensionTypes'

export const useNodeLibrarySidebarTab = (): SidebarTabExtension => {
  const urlParams = new URLSearchParams(window.location.search)
  const component = urlParams.get('nodeRedesign') === 'true'
    ? NodeLibrarySidebarTabV2
    : NodeLibrarySidebarTab

  return {
    id: 'node-library',
    icon: 'icon-[comfy--node]',
    title: 'sideToolbar.nodeLibrary',
    tooltip: 'sideToolbar.nodeLibrary',
    label: 'sideToolbar.labels.nodes',
    component: markRaw(component),
    type: 'vue'
  }
}
