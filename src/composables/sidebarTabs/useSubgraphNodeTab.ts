
import { markRaw } from 'vue'

import SubgraphNode from '@/components/selectionbar/SubgraphNode.vue'
import type { SidebarTabExtension } from '@/types/extensionTypes'

export const useSubgraphNodeTab = (): SidebarTabExtension => {
  return {
    id: 'sgn',
    icon: 'pi pi-chart-bar',
    iconBadge: () => {
      return null
    },
    title: 'subgraph widgets',
    tooltip: 'Change displayed subgraph widgets',
    label: 'subgraph widgets',
    component: markRaw(SubgraphNode),
    type: 'vue'
  }
}
