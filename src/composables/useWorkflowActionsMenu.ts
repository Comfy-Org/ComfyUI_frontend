import type { ComputedRef, Ref } from 'vue'
import { computed, ref, unref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useErrorHandling } from '@/composables/useErrorHandling'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { isCloud } from '@/platform/distribution/types'
import { openDeployToComfyApiDialog } from '@/platform/workflow/deploy/composables/lazyDeployToComfyApiDialog'
import { useDeployToComfyApiGate } from '@/platform/workflow/deploy/composables/useDeployToComfyApiGate'
import type { DeployGateState } from '@/platform/workflow/deploy/composables/useDeployToComfyApiGate'
import { openShareDialog } from '@/platform/workflow/sharing/composables/lazyShareDialog'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import {
  useWorkflowBookmarkStore,
  useWorkflowStore
} from '@/platform/workflow/management/stores/workflowStore'
import { useCommandStore } from '@/stores/commandStore'
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
  /**
   * Whether the host's menu is open. While it is, an already-visible row that
   * comes and goes with an account flag is never removed; a menu awaiting the
   * current account's answer may still add it on a yes. A row whose account
   * loses access stays in place, disabled, until the menu closes.
   */
  isOpen?: Readonly<Ref<boolean>>
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
  badge?: string
}

interface DeployRow {
  shown: boolean
  generation: number | undefined
}

function isDeployAllowed(gate: DeployGateState): boolean {
  return gate.status === 'answered' && gate.enabled
}

/**
 * Closed, the deploy row follows the gate. Open, it only changes when an
 * answer arrives for an account generation the menu has not seen, and then
 * only to add the row on a yes: a same-account flag change never moves it,
 * and a row already shown stays until the menu closes.
 */
function nextDeployRow(
  row: DeployRow,
  open: boolean,
  gate: DeployGateState
): DeployRow {
  const generation = gate.status === 'answered' ? gate.generation : undefined
  if (!open) return { shown: isDeployAllowed(gate), generation }
  if (generation === undefined || generation === row.generation) return row
  return { shown: row.shown || isDeployAllowed(gate), generation }
}

export function useWorkflowActionsMenu(
  startRename: () => void,
  options: WorkflowActionsMenuOptions = {}
) {
  const { isRoot = true, includeDelete = true, workflow, isOpen } = options
  const { t } = useI18n()
  const workflowStore = useWorkflowStore()
  const workflowService = useWorkflowService()
  const bookmarkStore = useWorkflowBookmarkStore()
  const commandStore = useCommandStore()
  const subgraphStore = useSubgraphStore()
  const menuItemStore = useMenuItemStore()
  const { flags } = useFeatureFlags()
  const deployGate = useDeployToComfyApiGate()
  const deployAllowed = computed(() => isDeployAllowed(deployGate.state.value))
  const deployRow = ref(
    nextDeployRow(
      { shown: false, generation: undefined },
      false,
      deployGate.state.value
    )
  )
  watch(
    [() => isOpen?.value ?? false, deployGate.state],
    ([open, gate], [wasOpen]) => {
      deployRow.value = nextDeployRow(deployRow.value, open, gate)
      if (open && (!wasOpen || gate.status === 'awaiting')) deployGate.check()
    }
  )
  if (!isOpen) deployGate.check()
  const appModeStore = useAppModeStore()
  const { enterBuilder, pruneLinearData } = appModeStore
  const { toastErrorHandler } = useErrorHandling()

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
      isNew = false,
      badge = isNew ? t('g.experimental') : undefined
    }: AddItemOptions) => {
      if (prependSeparator && visible) items.push({ separator: true })
      const item: WorkflowMenuAction = { id, label, icon, command, disabled }
      if (!visible) item.visible = false
      if (isNew) item.isNew = true
      if (badge) item.badge = badge
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
      command: () => openShareDialog().catch(toastErrorHandler),
      visible: isCloud && flags.workflowSharingEnabled
    })

    addItem({
      id: 'deploy-as-api',
      label: t('deployToComfyApi.buttonLabel'),
      icon: 'icon-[lucide--rocket]',
      command: async () => {
        if (!deployAllowed.value) return
        await ensureWorkflowActive(targetWorkflow.value)
        if (!unref(deployAllowed)) return
        await openDeployToComfyApiDialog().catch(toastErrorHandler)
      },
      visible: isRoot && deployRow.value.shown,
      disabled: !deployAllowed.value,
      isNew: true,
      badge: t('g.new')
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
      command: async () => await workflowService.saveWorkflowAs(workflow),
      visible: isRoot && isBlueprint,
      prependSeparator: true
    })

    addItem({
      id: 'delete',
      label: isBlueprint
        ? t('breadcrumbsMenu.deleteBlueprint')
        : t('breadcrumbsMenu.deleteWorkflow'),
      icon: 'pi pi-times',
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
