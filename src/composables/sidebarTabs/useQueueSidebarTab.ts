import { markRaw } from 'vue'

import QueueSidebarTab from '@/components/sidebar/tabs/QueueSidebarTab.vue'
import { useQueuePendingTaskCountStore } from '@/stores/queueStore'
import type { SidebarTabExtension } from '@/types/extensionTypes'

export const useQueueSidebarTab = (): SidebarTabExtension => {
  const queuePendingTaskCountStore = useQueuePendingTaskCountStore()
  return {
    id: 'queue',
    icon: 'pi pi-history',
    iconBadge: () => {
      const value = queuePendingTaskCountStore.count.toString()
      return value === '0' ? null : value
    },
    title: 'sideToolbar.queue',
    tooltip: 'sideToolbar.queue',
    label: 'sideToolbar.labels.queue',
    component: markRaw(QueueSidebarTab),
    type: 'vue'
  }
}
