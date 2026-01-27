import { defineAsyncComponent } from 'vue'

import { useQueueStore } from '@/stores/queueStore'
import type { SidebarTabExtension } from '@/types/extensionTypes'

const AssetsSidebarTab = defineAsyncComponent(
  () => import('@/components/sidebar/tabs/AssetsSidebarTab.vue')
)

export const useAssetsSidebarTab = (): SidebarTabExtension => {
  return {
    id: 'assets',
    icon: 'icon-[comfy--image-ai-edit]',
    title: 'sideToolbar.assets',
    tooltip: 'sideToolbar.assets',
    label: 'sideToolbar.labels.assets',
    component: AssetsSidebarTab,
    type: 'vue',
    iconBadge: () => {
      const queueStore = useQueueStore()
      return queueStore.pendingTasks.length > 0
        ? queueStore.pendingTasks.length.toString()
        : null
    }
  }
}
