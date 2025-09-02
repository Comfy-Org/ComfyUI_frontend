
import { markRaw } from 'vue'

import SubgraphNode from '@/components/selectionbar/SubgraphNode.vue'
import type { SidebarTabExtension } from '@/types/extensionTypes'

export const useSubgraphNodeTab = (): SidebarTabExtension => {
  return {
    id: 'sgn',
    icon: 'pi pi-history',
    iconBadge: () => {
      return null
    },
    title: 'sideToolbar.queue',
    tooltip: 'sideToolbar.queue',
    label: 'sideToolbar.labels.queue',
    component: markRaw(SubgraphNode),
    type: 'vue'
  }
}
