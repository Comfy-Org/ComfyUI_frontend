import { markRaw } from 'vue'

import CloudModelLibrarySidebarTab from '@/components/sidebar/tabs/cloudModelLibrary/CloudModelLibrarySidebarTab.vue'
import type { SidebarTabExtension } from '@/types/extensionTypes'

const CLOUD_MODEL_LIBRARY_TAB_ID = 'model-library'

export const useCloudModelLibrarySidebarTab = (): SidebarTabExtension => {
  return {
    id: CLOUD_MODEL_LIBRARY_TAB_ID,
    icon: 'icon-[comfy--ai-model]',
    title: 'sideToolbar.modelLibrary',
    tooltip: 'sideToolbar.modelLibrary',
    label: 'sideToolbar.labels.models',
    component: markRaw(CloudModelLibrarySidebarTab),
    type: 'vue'
  }
}
