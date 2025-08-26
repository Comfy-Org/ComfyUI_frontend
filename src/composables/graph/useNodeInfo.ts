import { useSelectedLiteGraphItems } from '@/composables/canvas/useSelectedLiteGraphItems'
import { t } from '@/i18n'
import { LGraphEventMode } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
// import { useDialogService } from '@/services/dialogService' // Using toasts instead
// import { useCanvasStore } from '@/stores/graphStore' // Unused for now
import { useToastStore } from '@/stores/toastStore'
import { useWorkflowStore } from '@/stores/workflowStore'
import { getExecutionIdsForSelectedNodes } from '@/utils/graphTraversalUtil'
import { filterOutputNodes } from '@/utils/nodeFilterUtil'

/**
 * Composable for handling node information and utility operations
 */
export function useNodeInfo() {
  const { getSelectedNodes, toggleSelectedNodesMode } =
    useSelectedLiteGraphItems()
  // const canvasStore = useCanvasStore() // Unused for now
  // const dialogService = useDialogService() // Using toasts instead
  const toastStore = useToastStore()
  const workflowStore = useWorkflowStore()

  const showNodeInfo = () => {
    const selectedNodes = getSelectedNodes()

    if (selectedNodes.length === 0) {
      toastStore.add({
        severity: 'warn',
        summary: t('g.noNodeSelected'),
        detail: t('g.pleaseSelectNodeForInfo'),
        life: 3000
      })
      return
    }

    if (selectedNodes.length === 1) {
      const node = selectedNodes[0]
      const info = {
        id: node.id,
        type: node.type,
        title: node.title,
        size: node.size,
        position: node.pos,
        mode: node.mode,
        inputs: node.inputs?.length || 0,
        outputs: node.outputs?.length || 0,
        widgets: node.widgets?.length || 0,
        pinned: node.pinned
      }

      const infoText = Object.entries(info)
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        .join('\n')

      toastStore.add({
        severity: 'info',
        summary: t('g.info'),
        detail: infoText,
        life: 5000
      })
    } else {
      // Multiple nodes selected - show summary
      const summary = {
        totalNodes: selectedNodes.length,
        nodeTypes: [...new Set(selectedNodes.map((n) => n.type))],
        totalInputs: selectedNodes.reduce(
          (sum, n) => sum + (n.inputs?.length || 0),
          0
        ),
        totalOutputs: selectedNodes.reduce(
          (sum, n) => sum + (n.outputs?.length || 0),
          0
        ),
        pinnedNodes: selectedNodes.filter((n) => n.pinned).length
      }

      const summaryText = Object.entries(summary)
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        .join('\n')

      toastStore.add({
        severity: 'info',
        summary: 'Selection Summary',
        detail: summaryText,
        life: 5000
      })
    }
  }

  const adjustNodeSize = () => {
    const selectedNodes = getSelectedNodes()

    if (selectedNodes.length === 0) {
      toastStore.add({
        severity: 'warn',
        summary: t('g.noNodeSelected'),
        detail: t('g.pleaseSelectNodesToResize'),
        life: 3000
      })
      return
    }

    selectedNodes.forEach((node) => {
      const optimalSize = node.computeSize()
      node.setSize([optimalSize[0], optimalSize[1]])
    })

    app.canvas.setDirty(true, true)
    workflowStore.activeWorkflow?.changeTracker?.checkState()

    toastStore.add({
      severity: 'success',
      summary: t('g.success'),
      detail: t('g.nodesSizedOptimally'),
      life: 2000
    })
  }

  const toggleNodeCollapse = () => {
    const selectedNodes = getSelectedNodes()

    if (selectedNodes.length === 0) {
      toastStore.add({
        severity: 'warn',
        summary: t('g.noNodeSelected'),
        detail: t('g.pleaseSelectNodesToToggle'),
        life: 3000
      })
      return
    }

    selectedNodes.forEach((node) => {
      node.collapse()
    })

    app.canvas.setDirty(true, true)
    workflowStore.activeWorkflow?.changeTracker?.checkState()
  }

  const toggleNodePin = () => {
    const selectedNodes = getSelectedNodes()

    if (selectedNodes.length === 0) {
      toastStore.add({
        severity: 'warn',
        summary: t('g.noNodeSelected'),
        detail: t('g.pleaseSelectNodesToPin'),
        life: 3000
      })
      return
    }

    selectedNodes.forEach((node) => {
      node.pin(!node.pinned)
    })

    app.canvas.setDirty(true, true)
    workflowStore.activeWorkflow?.changeTracker?.checkState()

    const pinnedCount = selectedNodes.filter((n) => n.pinned).length
    const action =
      pinnedCount > selectedNodes.length / 2 ? 'pinned' : 'unpinned'

    toastStore.add({
      severity: 'info',
      summary: t('g.success'),
      detail: t(`g.nodes${action.charAt(0).toUpperCase() + action.slice(1)}`),
      life: 2000
    })
  }

  const toggleNodeBypass = () => {
    toggleSelectedNodesMode(LGraphEventMode.BYPASS)
    app.canvas.setDirty(true, true)

    toastStore.add({
      severity: 'info',
      summary: t('g.success'),
      detail: t('g.nodesBypassToggled'),
      life: 2000
    })
  }

  const runBranch = async () => {
    const selectedNodes = getSelectedNodes()
    const selectedOutputNodes = filterOutputNodes(selectedNodes)

    if (selectedOutputNodes.length === 0) {
      toastStore.add({
        severity: 'error',
        summary: t('toastMessages.nothingToQueue'),
        detail: t('toastMessages.pleaseSelectOutputNodes'),
        life: 3000
      })
      return
    }

    try {
      // Get execution IDs for all selected output nodes and their descendants
      const executionIds = getExecutionIdsForSelectedNodes(selectedOutputNodes)
      await app.queuePrompt(0, 1, executionIds)

      toastStore.add({
        severity: 'success',
        summary: t('g.success'),
        detail: t('g.branchQueued'),
        life: 3000
      })
    } catch (error) {
      toastStore.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('g.failedToQueueBranch'),
        life: 3000
      })
    }
  }

  return {
    showNodeInfo,
    adjustNodeSize,
    toggleNodeCollapse,
    toggleNodePin,
    toggleNodeBypass,
    runBranch
  }
}
