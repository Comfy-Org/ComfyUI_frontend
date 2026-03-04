import { markRaw } from 'vue'

import AppsSidebarTab from '@/components/sidebar/tabs/AppsSidebarTab.vue'
import type { SidebarTabExtension } from '@/types/extensionTypes'

export const useAppsSidebarTab = (): SidebarTabExtension => {
  return {
    id: 'apps',
    icon: 'icon-[lucide--panels-top-left]',
    title: 'linearMode.appModeToolbar.apps',
    tooltip: 'linearMode.appModeToolbar.apps',
    component: markRaw(AppsSidebarTab),
    type: 'vue'
  }
}
