import { markRaw } from 'vue'

import DiscoverView from '@/components/discover/DiscoverView.vue'
import type { SidebarTabExtension } from '@/types/extensionTypes'

export function useDiscoverSidebarTab(): SidebarTabExtension {
  return {
    id: 'discover',
    icon: 'icon-[lucide--compass]',
    title: 'sideToolbar.discover',
    tooltip: 'sideToolbar.discover',
    type: 'vue',
    component: markRaw(DiscoverView)
  }
}
