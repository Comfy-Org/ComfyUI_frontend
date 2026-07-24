import { markRaw } from 'vue'

import type { SidebarTabExtension } from '@/types/extensionTypes'

import ModelManagerSidebarTab from '../components/ModelManagerSidebarTab.vue'
import { useModelDownloadStore } from '../stores/modelDownloadStore'

export function useModelManagerSidebarTab(): SidebarTabExtension {
  return {
    id: 'model-manager',
    icon: 'icon-[lucide--download]',
    title: 'modelManager.title',
    tooltip: 'modelManager.title',
    label: 'modelManager.title',
    component: markRaw(ModelManagerSidebarTab),
    type: 'vue',
    iconBadge: () => {
      const count = useModelDownloadStore().activeDownloadCount
      return count > 0 ? count.toString() : null
    }
  }
}
