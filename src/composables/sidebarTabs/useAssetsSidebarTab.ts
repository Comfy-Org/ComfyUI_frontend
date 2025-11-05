import { markRaw } from 'vue'

import AssetsSidebarTab from '@/components/sidebar/tabs/AssetsSidebarTab.vue'
import type { SidebarTabExtension } from '@/types/extensionTypes'

export const useAssetsSidebarTab = (): SidebarTabExtension => {
  return {
    id: 'assets',
    icon: 'icon-[comfy--image-ai-edit]',
    title: 'sideToolbar.assets',
    tooltip: 'sideToolbar.assets',
    label: 'sideToolbar.labels.assets',
    component: markRaw(AssetsSidebarTab),
    type: 'vue'
  }
}
