import { markRaw } from 'vue'
import { useI18n } from 'vue-i18n'

import QueueSidebarTab from '@/components/sidebar/tabs/QueueSidebarTab.vue'
import { useQueuePendingTaskCountStore } from '@/stores/queueStore'
import type { SidebarTabExtension } from '@/types/extensionTypes'

export const useQueueSidebarTab = (): SidebarTabExtension => {
  const { t } = useI18n()
  const queuePendingTaskCountStore = useQueuePendingTaskCountStore()
  return {
    id: 'queue',
    icon: 'pi pi-history',
    iconBadge: () => {
      const value = queuePendingTaskCountStore.count.toString()
      return value === '0' ? null : value
    },
    title: t('sideToolbar.queue'),
    tooltip: t('sideToolbar.queue'),
    component: markRaw(QueueSidebarTab),
    type: 'vue'
  }
}
