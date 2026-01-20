import { markRaw } from 'vue'

import AssetsSidebarTab from '@/components/sidebar/tabs/AssetsSidebarTab.vue'
import { useQueuePendingTaskCountStore } from '@/stores/queueStore'
import type { SidebarTabExtension } from '@/types/extensionTypes'

export const useAssetsSidebarTab = (): SidebarTabExtension => {
  return {
    id: 'assets',
    icon: 'icon-[comfy--image-ai-edit]',
    title: 'sideToolbar.assets',
    tooltip: 'sideToolbar.assets',
    label: 'sideToolbar.labels.assets',
    component: markRaw(AssetsSidebarTab),
    type: 'vue',
    iconBadge: () => {
      const queuePendingTaskCountStore = useQueuePendingTaskCountStore()
      const pendingCount = queuePendingTaskCountStore.count - 1
      return pendingCount > 0 ? pendingCount.toString() : null
    }
  }
}
