import { markRaw } from 'vue'
import { useI18n } from 'vue-i18n'

import WorkflowsSidebarTab from '@/components/sidebar/tabs/WorkflowsSidebarTab.vue'
import { useSettingStore } from '@/stores/settingStore'
import { useWorkflowStore } from '@/stores/workflowStore'
import type { SidebarTabExtension } from '@/types/extensionTypes'

export const useWorkflowsSidebarTab = (): SidebarTabExtension => {
  const { t } = useI18n()
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
    title: t('sideToolbar.workflows'),
    tooltip: t('sideToolbar.workflows'),
    component: markRaw(WorkflowsSidebarTab),
    type: 'vue'
  }
}
