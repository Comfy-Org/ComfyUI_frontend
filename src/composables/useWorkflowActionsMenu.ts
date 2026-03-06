import type { ComputedRef, Ref } from 'vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { showConfirmDialog } from '@/components/dialog/confirm/confirmDialog'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import {
  useWorkflowBookmarkStore,
  useWorkflowStore
} from '@/platform/workflow/management/stores/workflowStore'
import { useCommandStore } from '@/stores/commandStore'
import { useDialogStore } from '@/stores/dialogStore'
import { useMenuItemStore } from '@/stores/menuItemStore'
import { useSubgraphStore } from '@/stores/subgraphStore'
import { useAppModeStore } from '@/stores/appModeStore'
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
  const { flags } = useFeatureFlags()
  const { closeDialog } = useDialogStore()
  const { enterBuilder, pruneLinearData } = useAppModeStore()

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
      if (prependSeparator && visible) items.push({ separator: true })
      const item: WorkflowMenuAction = { id, label, icon, command, disabled }
      if (!visible) item.visible = false
      if (isNew) {
        item.badge = t('g.experimental')
        item.isNew = true
      }
      items.push(item)
    }

    const workflowMode =
      workflow?.activeMode ?? workflow?.initialMode ?? 'graph'
    const isLinearMode = workflowMode === 'app'
    const showAppModeItems =
      isRoot && (menuItemStore.hasSeenLinear || flags.linearToggleEnabled)
    const isBookmarked = bookmarkStore.isBookmarked(workflow?.path ?? '')

    const toggleLinear = async () => {
      await ensureWorkflowActive(targetWorkflow.value)
      await commandStore.execute('Comfy.ToggleLinear', {
        metadata: { source: 'breadcrumb_menu' }
      })
    }
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
      id: 'share',
      label: t('breadcrumbsMenu.share'),
      icon: 'icon-[comfy--send]',
      visible: false,
      command: async () => {
        // TODO: extract this to the sharing service
        const wf = targetWorkflow.value
        if (!wf) return

        const isAppDefault = wf.initialMode === 'app'
        const linearData = wf.changeTracker?.activeState?.extra?.linearData
        const { outputs } = pruneLinearData(linearData)

        if (isAppDefault && outputs.length === 0) {
          const dialog = showConfirmDialog({
            headerProps: {
              title: t('shareNoOutputs.title')
            },
            props: {
              promptText: t('shareNoOutputs.message'),
              preserveNewlines: true
            },
            footerProps: {
              confirmText: t('shareNoOutputs.shareAnyway'),
              confirmVariant: 'secondary',
              onCancel: () => closeDialog(dialog),
              onConfirm: () => {
                closeDialog(dialog)
                // TODO: proceed with share
              }
            }
          })
          return
        }

        // TODO: proceed with share
      }
    })

    addItem({
      id: 'enter-app-mode',
      label: t('breadcrumbsMenu.enterAppMode'),
      icon: 'icon-[lucide--panels-top-left]',
      command: toggleLinear,
      visible: showAppModeItems && !isLinearMode,
      prependSeparator: true,
      isNew: true
    })

    addItem({
      id: 'exit-app-mode',
      label: t('breadcrumbsMenu.exitAppMode'),
      icon: 'icon-[comfy--workflow]',
      command: toggleLinear,
      visible: isLinearMode,
      prependSeparator: true
    })

    const hasLinearData = (() => {
      const ld = workflow?.changeTracker?.activeState?.extra?.linearData
      if (ld)
        return (ld.inputs?.length ?? 0) > 0 || (ld.outputs?.length ?? 0) > 0
      return workflow?.path?.endsWith('.app.json') ?? false
    })()

    addItem({
      id: 'enter-builder-mode',
      label: hasLinearData
        ? t('breadcrumbsMenu.editBuilderMode')
        : t('breadcrumbsMenu.enterBuilderMode'),
      icon: 'icon-[lucide--hammer]',
      command: async () => {
        await ensureWorkflowActive(targetWorkflow.value)
        enterBuilder()
      },
      visible: showAppModeItems,
      isNew: true
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
