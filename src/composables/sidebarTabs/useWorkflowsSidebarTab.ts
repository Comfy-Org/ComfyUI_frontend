import { markRaw } from 'vue'

import WorkflowsSidebarTab from '@/components/sidebar/tabs/WorkflowsSidebarTab.vue'
import { useSettingStore } from '@/stores/settingStore'
import { useWorkflowStore } from '@/stores/workflowStore'
import type { SidebarTabExtension } from '@/types/extensionTypes'

export const useWorkflowsSidebarTab = (): SidebarTabExtension => {
  const settingStore = useSettingStore()
  const workflowStore = useWorkflowStore()
  return {
    id: 'workflows',
    icon: 'pi pi-folder-open',
    iconBadge: () => {
      if (
        settingStore.get('Comfy.Workflow.WorkflowTabsPosition') !== 'Sidebar'
      ) {
        return null
      }
      const value = workflowStore.openWorkflows.length.toString()
      return value === '0' ? null : value
    },
    title: 'sideToolbar.workflows',
    tooltip: 'sideToolbar.workflows',
    component: markRaw(WorkflowsSidebarTab),
    type: 'vue'
  }
}
