import { markRaw } from 'vue'

import TemplatesSidebarTab from '@/components/sidebar/tabs/TemplatesSidebarTab.vue'
import type { SidebarTabExtension } from '@/types/extensionTypes'

export const useTemplatesSidebarTab = (): SidebarTabExtension => {
  return {
    id: 'templates',
    icon: 'icon-[comfy--template]',
    title: 'sideToolbar.templates',
    tooltip: 'sideToolbar.templates',
    label: 'sideToolbar.labels.templates',
    component: markRaw(TemplatesSidebarTab),
    type: 'vue'
  }
}
