import type { ComputedRef, Ref } from 'vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useEnterBuilder } from '@/components/builder/useEnterBuilder'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { isCloud } from '@/platform/distribution/types'
import { openDeployToComfyApiDialog } from '@/platform/workflow/deploy/composables/lazyDeployToComfyApiDialog'
import { DEPLOY_TO_COMFY_API_ACTION_ID } from '@/platform/workflow/deploy/constants'
import { openShareDialog } from '@/platform/workflow/sharing/composables/lazyShareDialog'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import {
  useWorkflowBookmarkStore,
  useWorkflowStore
} from '@/platform/workflow/management/stores/workflowStore'
import { useCommandStore } from '@/platform/keybindings/commandStore'
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
  newItemBadge?: string
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
  const appModeStore = useAppModeStore()
  const { pruneLinearData } = appModeStore
  const { enterBuilder } = useEnterBuilder()
  const { toastErrorHandler } = useErrorHandling()

  const targetWorkflow = computed(
    () => workflow?.value ?? workflowStore.activeWorkflow
  )

  /** Switch to the target workflow tab if it's not already active */
  const ensureWorkflowActive = async (wf: ComfyWorkflow | null) => {
    if (!wf || wf === workflowStore.activeWorkflow) return true
    return await workflowService.openWorkflow(wf, { initiator: 'user' })
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
      newItemBadge
    }: AddItemOptions) => {
      if (prependSeparator && visible) items.push({ separator: true })
      const item: WorkflowMenuAction = { id, label, icon, command, disabled }
      if (!visible) item.visible = false
      if (newItemBadge) item.badge = newItemBadge
      items.push(item)
    }

    const workflowMode =
      workflow?.activeMode ?? workflow?.initialMode ?? 'graph'
    const isLinearMode = workflowMode === 'app'
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
      icon: 'icon-[lucide--pencil]',
      command: async () => {
        await ensureWorkflowActive(targetWorkflow.value)
        startRename()
      },
      disabled: isRoot && !workflow?.isPersisted
    })

    addItem({
      id: 'duplicate',
      label: t('breadcrumbsMenu.duplicate'),
      icon: 'icon-[lucide--copy]',
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
      icon: 'icon-[lucide--save]',
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
      icon: 'icon-[lucide--save]',
      command: async () => {
        await ensureWorkflowActive(workflow)
        await commandStore.execute('Comfy.SaveWorkflowAs')
      },
      visible: isRoot
    })

    addItem({
      id: 'export',
      label: t('menuLabels.Export'),
      icon: 'icon-[lucide--download]',
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
      icon: 'icon-[lucide--download]',
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
      command: () => openShareDialog().catch(toastErrorHandler),
      visible: isCloud
    })

    addItem({
      id: DEPLOY_TO_COMFY_API_ACTION_ID,
      label: t('deployToComfyApi.buttonLabel'),
      icon: 'icon-[lucide--rocket]',
      command: async () => {
        if (!(await ensureWorkflowActive(targetWorkflow.value))) return
        await openDeployToComfyApiDialog().catch(toastErrorHandler)
      },
      visible: isRoot && !isCloud,
      newItemBadge: t('g.new')
    })

    addItem({
      id: 'enter-app-mode',
      label: t('breadcrumbsMenu.enterAppMode'),
      icon: 'icon-[lucide--panels-top-left]',
      command: toggleLinear,
      visible: isRoot && !isLinearMode,
      prependSeparator: true,
      newItemBadge: t('g.experimental')
    })

    addItem({
      id: 'exit-app-mode',
      label: t('breadcrumbsMenu.exitAppMode'),
      icon: 'icon-[comfy--workflow]',
      command: toggleLinear,
      visible: isLinearMode,
      prependSeparator: true
    })

    if (!workflow) return items
    const isActive = workflow === workflowStore.activeWorkflow
    const getLinearData = (
      tracker: typeof workflow.changeTracker | undefined
    ) => {
      if (!tracker) return undefined
      return tracker.activeState.extra?.linearData
    }
    const rawLd = isActive
      ? {
          inputs: appModeStore.selectedInputs,
          outputs: appModeStore.selectedOutputs
        }
      : getLinearData(workflow.changeTracker)
    let hasLinearData: boolean
    if (rawLd) {
      const { inputs, outputs } = pruneLinearData(rawLd)
      hasLinearData = inputs.length > 0 || outputs.length > 0
    } else {
      hasLinearData = workflow.path.endsWith('.app.json')
    }

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
      visible: isRoot,
      newItemBadge: t('g.experimental')
    })

    addItem({
      id: 'clear-workflow',
      label: t('breadcrumbsMenu.clearWorkflow'),
      icon: 'icon-[lucide--trash-2]',
      command: async () => {
        await ensureWorkflowActive(workflow)
        await commandStore.execute('Comfy.ClearWorkflow')
      },
      prependSeparator: true
    })

    addItem({
      id: 'publish',
      label: t('subgraphStore.publish'),
      icon: 'icon-[lucide--upload]',
      command: async () => await workflowService.saveWorkflowAs(workflow),
      visible: isRoot && isBlueprint,
      prependSeparator: true
    })

    addItem({
      id: 'delete',
      label: isBlueprint
        ? t('breadcrumbsMenu.deleteBlueprint')
        : t('breadcrumbsMenu.deleteWorkflow'),
      icon: 'icon-[lucide--x]',
      command: async () => await workflowService.deleteWorkflow(workflow),
      visible: isRoot && includeDelete,
      prependSeparator: true
    })

    return items
  })

  return {
    menuItems
  }
}
