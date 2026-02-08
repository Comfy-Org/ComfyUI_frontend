import type { MenuItem } from 'primevue/menuitem'
import type { ComputedRef, Ref } from 'vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import {
  useWorkflowBookmarkStore,
  useWorkflowStore
} from '@/platform/workflow/management/stores/workflowStore'
import { useCommandStore } from '@/stores/commandStore'
import { useSubgraphStore } from '@/stores/subgraphStore'

interface WorkflowActionsMenuOptions {
  /** Whether this is the root workflow level. Defaults to true. */
  isRoot?: boolean
  /** Whether to include the delete workflow action. Defaults to true. */
  includeDelete?: boolean
  /** Override the workflow to operate on. If not provided, uses activeWorkflow. */
  workflow?: Ref<ComfyWorkflow | null> | ComputedRef<ComfyWorkflow | null>
}

export function useWorkflowActionsMenu(
  startRename: () => void,
  options: WorkflowActionsMenuOptions = {}
) {
  const { isRoot = true, includeDelete = true, workflow } = options
  const { t } = useI18n()
  const workflowStore = useWorkflowStore()
  const workflowService = useWorkflowService()
  const bookmarkStore = useWorkflowBookmarkStore()
  const commandStore = useCommandStore()
  const subgraphStore = useSubgraphStore()

  const targetWorkflow = computed(
    () => workflow?.value ?? workflowStore.activeWorkflow
  )

  /** Switch to the target workflow tab if it's not already active */
  const ensureWorkflowActive = async (wf: ComfyWorkflow | null) => {
    if (!wf || wf === workflowStore.activeWorkflow) return
    await workflowService.openWorkflow(wf)
  }

  const menuItems = computed<MenuItem[]>(() => {
    const workflow = targetWorkflow.value
    const isBlueprint = workflow
      ? subgraphStore.isSubgraphBlueprint(workflow)
      : false

    const items: MenuItem[] = []

    const addItem = (
      label: string,
      icon: string,
      command: () => void,
      visible = true,
      disabled = false,
      separator = false
    ) => {
      if (!visible) return
      if (separator) items.push({ separator: true })
      items.push({ label, icon, command, disabled })
    }

    addItem(
      t('g.rename'),
      'pi pi-pencil',
      async () => {
        await ensureWorkflowActive(targetWorkflow.value)
        startRename()
      },
      true,
      isRoot && !workflow?.isPersisted
    )

    addItem(
      t('breadcrumbsMenu.duplicate'),
      'pi pi-copy',
      async () => {
        if (workflow) {
          await workflowService.duplicateWorkflow(workflow)
        }
      },
      isRoot && !isBlueprint
    )

    addItem(
      t('menuLabels.Save'),
      'pi pi-save',
      async () => {
        await ensureWorkflowActive(workflow)
        await commandStore.execute('Comfy.SaveWorkflow')
      },
      isRoot,
      false,
      true
    )

    addItem(
      t('menuLabels.Save As'),
      'pi pi-save',
      async () => {
        await ensureWorkflowActive(workflow)
        await commandStore.execute('Comfy.SaveWorkflowAs')
      },
      isRoot
    )

    addItem(
      bookmarkStore.isBookmarked(workflow?.path ?? '')
        ? t('tabMenu.removeFromBookmarks')
        : t('tabMenu.addToBookmarks'),
      `pi pi-bookmark${bookmarkStore.isBookmarked(workflow?.path ?? '') ? '-fill' : ''}`,
      async () => {
        if (workflow?.path) {
          await bookmarkStore.toggleBookmarked(workflow.path)
        }
      },
      isRoot,
      workflow?.isTemporary ?? false
    )

    addItem(
      t('menuLabels.Export'),
      'pi pi-download',
      async () => {
        await ensureWorkflowActive(workflow)
        await commandStore.execute('Comfy.ExportWorkflow')
      },
      isRoot
    )

    addItem(
      t('menuLabels.Export (API)'),
      'pi pi-download',
      async () => {
        await ensureWorkflowActive(workflow)
        await commandStore.execute('Comfy.ExportWorkflowAPI')
      },
      isRoot
    )

    addItem(
      t('breadcrumbsMenu.clearWorkflow'),
      'pi pi-trash',
      async () => {
        await ensureWorkflowActive(workflow)
        await commandStore.execute('Comfy.ClearWorkflow')
      },
      true,
      false,
      true
    )

    addItem(
      t('subgraphStore.publish'),
      'pi pi-upload',
      async () => {
        if (workflow) {
          await workflowService.saveWorkflowAs(workflow)
        }
      },
      isRoot && isBlueprint,
      false,
      true
    )

    addItem(
      isBlueprint
        ? t('breadcrumbsMenu.deleteBlueprint')
        : t('breadcrumbsMenu.deleteWorkflow'),
      'pi pi-times',
      async () => {
        if (workflow) {
          await workflowService.deleteWorkflow(workflow)
        }
      },
      isRoot && includeDelete,
      false,
      true
    )

    return items
  })

  return {
    menuItems
  }
}
