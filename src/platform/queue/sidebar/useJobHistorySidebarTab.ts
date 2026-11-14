import { markRaw } from 'vue'

import JobHistorySidebarTab from '@/platform/queue/sidebar/JobHistorySidebarTab.vue'
import { useQueueStore } from '@/platform/queue/stores/queueStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
import type { SidebarTabExtension } from '@/types/extensionTypes'

export const useJobHistorySidebarTab = (): SidebarTabExtension => {
  return {
    id: 'job-history',
    icon: 'icon-[lucide--history]',
    title: 'queue.jobHistory',
    tooltip: 'queue.jobHistory',
    label: 'queue.jobHistory',
    component: markRaw(JobHistorySidebarTab),
    type: 'vue',
    iconBadge: () => {
      const sidebarTabStore = useSidebarTabStore()
      if (sidebarTabStore.activeSidebarTabId === 'job-history') {
        return null
      }

      const queueStore = useQueueStore()
      const count = queueStore.activeJobsCount
      return count > 0 ? count.toString() : null
    }
  }
}
