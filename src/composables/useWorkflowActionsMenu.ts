import type { ComputedRef, Ref } from 'vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import {
  useWorkflowBookmarkStore,
  useWorkflowStore
} from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCommandStore } from '@/stores/commandStore'
import { useMenuItemStore } from '@/stores/menuItemStore'
import { useSubgraphStore } from '@/stores/subgraphStore'
import type {
  WorkflowMenuAction,
  WorkflowMenuItem
} from '@/types/workflowMenuItem'

interface WorkflowActionsMenuOptions {
  /** Whether this is the root workflow level. Defaults to true. */
  isRoot?: boolean
  /** Whether to include the delete workflow action. Defaults to true. */
  includeDelete?: boolean
  /** Override the workflow to operate on. If not provided, uses activeWorkflow. */
  workflow?: Ref<ComfyWorkflow | null> | ComputedRef<ComfyWorkflow | null>
}

interface AddItemOptions {
  id: string
  label: string
  icon: string
  command: () => void
  visible?: boolean
  disabled?: boolean
  prependSeparator?: boolean
  isNew?: boolean
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
  const menuItemStore = useMenuItemStore()
  const canvasStore = useCanvasStore()
  const { flags } = useFeatureFlags()

  const targetWorkflow = computed(
    () => workflow?.value ?? workflowStore.activeWorkflow
  )

  /** Switch to the target workflow tab if it's not already active */
  const ensureWorkflowActive = async (wf: ComfyWorkflow | null) => {
    if (!wf || wf === workflowStore.activeWorkflow) return
    await workflowService.openWorkflow(wf)
  }

  const menuItems = computed<WorkflowMenuItem[]>(() => {
    const workflow = targetWorkflow.value
    const isBlueprint = workflow
      ? subgraphStore.isSubgraphBlueprint(workflow)
      : false

    const items: WorkflowMenuItem[] = []

    const addItem = ({
      id,
      label,
      icon,
      command,
      visible = true,
      disabled = false,
      prependSeparator = false,
      isNew = false
    }: AddItemOptions) => {
      if (!visible) return
      if (prependSeparator) items.push({ separator: true })
      const item: WorkflowMenuAction = { id, label, icon, command, disabled }
      if (isNew) {
        item.badge = t('g.experimental')
        item.isNew = true
      }
      items.push(item)
    }

    const isLinearMode = canvasStore.linearMode
    const showAppModeItems =
      isRoot && (menuItemStore.hasSeenLinear || flags.linearToggleEnabled)
    const isBookmarked = bookmarkStore.isBookmarked(workflow?.path ?? '')

    addItem({
      id: 'rename',
      label: t('g.rename'),
      icon: 'pi pi-pencil',
      command: async () => {
        await ensureWorkflowActive(targetWorkflow.value)
        startRename()
      },
      disabled: isRoot && !workflow?.isPersisted
    })

    addItem({
      id: 'duplicate',
      label: t('breadcrumbsMenu.duplicate'),
      icon: 'pi pi-copy',
      command: async () => {
        if (workflow) {
          await workflowService.duplicateWorkflow(workflow)
        }
      },
      visible: isRoot && !isBlueprint
    })

    addItem({
      id: 'toggle-bookmark',
      label: isBookmarked
        ? t('tabMenu.removeFromBookmarks')
        : t('tabMenu.addToBookmarks'),
      icon: 'pi pi-bookmark' + (isBookmarked ? '-fill' : ''),
      command: async () => {
        if (workflow?.path) {
          await bookmarkStore.toggleBookmarked(workflow.path)
        }
      },
      visible: isRoot,
      disabled: workflow?.isTemporary ?? false
    })

    addItem({
      id: 'save',
      label: t('menuLabels.Save'),
      icon: 'pi pi-save',
      command: async () => {
        await ensureWorkflowActive(workflow)
        await commandStore.execute('Comfy.SaveWorkflow')
      },
      visible: isRoot,
      prependSeparator: true
    })

    addItem({
      id: 'save-as',
      label: t('menuLabels.Save As'),
      icon: 'pi pi-save',
      command: async () => {
        await ensureWorkflowActive(workflow)
        await commandStore.execute('Comfy.SaveWorkflowAs')
      },
      visible: isRoot
    })

    addItem({
      id: 'export',
      label: t('menuLabels.Export'),
      icon: 'pi pi-download',
      command: async () => {
        await ensureWorkflowActive(workflow)
        await commandStore.execute('Comfy.ExportWorkflow')
      },
      visible: isRoot,
      prependSeparator: true
    })

    addItem({
      id: 'export-api',
      label: t('menuLabels.Export (API)'),
      icon: 'pi pi-download',
      command: async () => {
        await ensureWorkflowActive(workflow)
        await commandStore.execute('Comfy.ExportWorkflowAPI')
      },
      visible: isRoot
    })

    addItem({
      id: 'toggle-app-mode',
      label: isLinearMode
        ? t('breadcrumbsMenu.exitAppMode')
        : t('breadcrumbsMenu.enterAppMode'),
      icon: isLinearMode
        ? 'icon-[comfy--workflow]'
        : 'icon-[lucide--panels-top-left]',
      command: async () => {
        await commandStore.execute('Comfy.ToggleLinear', {
          metadata: { source: 'breadcrumb_menu' }
        })
      },
      visible: showAppModeItems,
      prependSeparator: true,
      isNew: !isLinearMode
    })

    addItem({
      id: 'clear-workflow',
      label: t('breadcrumbsMenu.clearWorkflow'),
      icon: 'pi pi-trash',
      command: async () => {
        await ensureWorkflowActive(workflow)
        await commandStore.execute('Comfy.ClearWorkflow')
      },
      prependSeparator: true
    })

    addItem({
      id: 'publish',
      label: t('subgraphStore.publish'),
      icon: 'pi pi-upload',
      command: async () => {
        if (workflow) {
          await workflowService.saveWorkflowAs(workflow)
        }
      },
      visible: isRoot && isBlueprint,
      prependSeparator: true
    })

    addItem({
      id: 'delete',
      label: isBlueprint
        ? t('breadcrumbsMenu.deleteBlueprint')
        : t('breadcrumbsMenu.deleteWorkflow'),
      icon: 'pi pi-times',
      command: async () => {
        if (workflow) {
          await workflowService.deleteWorkflow(workflow)
        }
      },
      visible: isRoot && includeDelete,
      prependSeparator: true
    })

    return items
  })

  return {
    menuItems
  }
}
