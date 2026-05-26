import { markRaw } from 'vue'

import DeprecationWarningsTab from '@/components/sidebar/tabs/DeprecationWarningsTab.vue'
import { useDeprecationWarningsStore } from '@/platform/dev/deprecationWarningsStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
import type { SidebarTabExtension } from '@/types/extensionTypes'
import { formatBadgeCount } from '@/utils/numberUtil'

export const DEPRECATION_WARNINGS_TAB_ID = 'deprecation-warnings'

export function useDeprecationWarningsSidebarTab(): SidebarTabExtension {
  return {
    id: DEPRECATION_WARNINGS_TAB_ID,
    icon: 'icon-[lucide--triangle-alert]',
    title: 'deprecationWarnings.title',
    tooltip: 'deprecationWarnings.title',
    label: 'deprecationWarnings.label',
    component: markRaw(DeprecationWarningsTab),
    type: 'vue',
    placement: 'bottom',
    iconBadge: () => {
      const sidebarTabStore = useSidebarTabStore()
      if (sidebarTabStore.activeSidebarTabId === DEPRECATION_WARNINGS_TAB_ID) {
        return null
      }
      const count = useDeprecationWarningsStore().unseenCount
      return count > 0 ? formatBadgeCount(count, 9) : null
    }
  }
}
