import { markRaw } from 'vue'

import AssetsSidebarTab from '@/components/sidebar/tabs/AssetsSidebarTab.vue'
import { useQueueStore } from '@/stores/queueStore'
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
      const queueStore = useQueueStore()
      return queueStore.pendingTasks.length > 0
        ? queueStore.pendingTasks.length.toString()
        : null
    }
  }
}
