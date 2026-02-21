import { markRaw } from 'vue'

import JobHistorySidebarTab from '@/components/sidebar/tabs/JobHistorySidebarTab.vue'
import type { SidebarTabExtension } from '@/types/extensionTypes'

export const useJobHistorySidebarTab = (): SidebarTabExtension => {
  return {
    id: 'job-history',
    icon: 'icon-[lucide--history]',
    title: 'queue.jobHistory',
    tooltip: 'queue.jobHistory',
    label: 'queue.jobHistory',
    component: markRaw(JobHistorySidebarTab),
    type: 'vue'
  }
}
