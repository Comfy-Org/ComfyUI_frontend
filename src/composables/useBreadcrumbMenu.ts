import type { MenuItem } from 'primevue/menuitem'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCommandStore } from '@/stores/commandStore'

export function useBreadcrumbMenu(item: MenuItem, startRename: () => void) {
  const { t } = useI18n()
  const workflowStore = useWorkflowStore()
  const workflowService = useWorkflowService()

  const isRoot = item.key === 'root'
  const isBlueprint = item.isBlueprint ?? false

  const menuItems = computed<MenuItem[]>(() => {
    return [
      {
        label: t('g.rename'),
        icon: 'pi pi-pencil',
        command: startRename,
        disabled: isRoot && !workflowStore.activeWorkflow?.isPersisted
      },
      {
        label: t('breadcrumbsMenu.duplicate'),
        icon: 'pi pi-copy',
        command: async () => {
          await workflowService.duplicateWorkflow(workflowStore.activeWorkflow!)
        },
        visible: isRoot && !isBlueprint
      },
      {
        separator: true,
        visible: isRoot
      },
      {
        label: t('menuLabels.Save'),
        icon: 'pi pi-save',
        command: async () => {
          await useCommandStore().execute('Comfy.SaveWorkflow')
        },
        visible: isRoot
      },
      {
        label: t('menuLabels.Save As'),
        icon: 'pi pi-save',
        command: async () => {
          await useCommandStore().execute('Comfy.SaveWorkflowAs')
        },
        visible: isRoot
      },
      {
        separator: true
      },
      {
        label: t('breadcrumbsMenu.clearWorkflow'),
        icon: 'pi pi-trash',
        command: async () => {
          await useCommandStore().execute('Comfy.ClearWorkflow')
        }
      },
      {
        separator: true,
        visible: isRoot && isBlueprint
      },
      {
        label: t('subgraphStore.publish'),
        icon: 'pi pi-copy',
        command: async () => {
          await workflowService.saveWorkflowAs(workflowStore.activeWorkflow!)
        },
        visible: isRoot && isBlueprint
      },
      {
        separator: true,
        visible: isRoot
      },
      {
        label: isBlueprint
          ? t('breadcrumbsMenu.deleteBlueprint')
          : t('breadcrumbsMenu.deleteWorkflow'),
        icon: 'pi pi-times',
        command: async () => {
          await workflowService.deleteWorkflow(workflowStore.activeWorkflow!)
        },
        visible: isRoot
      }
    ]
  })

  return {
    menuItems
  }
}
