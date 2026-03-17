import { defineStore } from 'pinia'
import { reactive, computed, watch } from 'vue'
import { useEventListener } from '@vueuse/core'

import { useEmptyWorkflowDialog } from '@/components/builder/useEmptyWorkflowDialog'
import { useAppMode } from '@/composables/useAppMode'
import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { LinearData } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
import { app } from '@/scripts/app'
import { ChangeTracker } from '@/scripts/changeTracker'
import { isPromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetTypes'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { resolveNode } from '@/utils/litegraphUtil'

export function nodeTypeValidForApp(type: string) {
  return !['Note', 'MarkdownNote'].includes(type)
}

export const useAppModeStore = defineStore('appMode', () => {
  const { getCanvas } = useCanvasStore()
  const workflowStore = useWorkflowStore()
  const { mode, setMode, isBuilderMode, isSelectMode } = useAppMode()
  const emptyWorkflowDialog = useEmptyWorkflowDialog()

  const selectedInputs = reactive<[NodeId, string][]>([])
  const selectedOutputs = reactive<NodeId[]>([])
  const hasOutputs = computed(() => !!selectedOutputs.length)
  const hasNodes = computed(() => {
    // Nodes are not reactive, so trigger recomputation when workflow changes
    void workflowStore.activeWorkflow
    void mode.value
    return !!app.rootGraph?.nodes?.length
  })

  // Prune entries referencing nodes deleted in workflow mode.
  // Only check node existence, not widgets — dynamic widgets can
  // hide/show other widgets so a missing widget does not mean stale data.
  function pruneLinearData(data: Partial<LinearData> | undefined): LinearData {
    const rawInputs = data?.inputs ?? []
    const rawOutputs = data?.outputs ?? []

    return {
      inputs: app.rootGraph
        ? rawInputs.filter(([nodeId]) => resolveNode(nodeId))
        : rawInputs,
      outputs: app.rootGraph
        ? rawOutputs.filter((nodeId) => resolveNode(nodeId))
        : rawOutputs
    }
  }

  function loadSelections(data: Partial<LinearData> | undefined) {
    const { inputs, outputs } = pruneLinearData(data)
    selectedInputs.splice(0, selectedInputs.length, ...inputs)
    selectedOutputs.splice(0, selectedOutputs.length, ...outputs)
  }

  function resetSelectedToWorkflow() {
    const { activeWorkflow } = workflowStore
    if (!activeWorkflow) return

    loadSelections(activeWorkflow.changeTracker?.activeState?.extra?.linearData)
  }

  watch(
    () => workflowStore.activeWorkflow,
    (newWorkflow) => {
      if (newWorkflow) {
        loadSelections(
          newWorkflow.changeTracker?.activeState?.extra?.linearData
        )
      } else {
        loadSelections(undefined)
      }
    },
    { immediate: true }
  )

  useEventListener(
    () => app.rootGraph?.events,
    'configured',
    resetSelectedToWorkflow
  )

  watch(
    () =>
      isBuilderMode.value
        ? { inputs: selectedInputs, outputs: selectedOutputs }
        : null,
    (data) => {
      if (!data || ChangeTracker.isLoadingGraph) return
      const graph = app.rootGraph
      if (!graph) return
      const extra = (graph.extra ??= {})
      extra.linearData = {
        inputs: [...data.inputs],
        outputs: [...data.outputs]
      }
    },
    { deep: true }
  )

  let unwatch: () => void | undefined
  watch(isSelectMode, (inSelect) => {
    const { state } = getCanvas()
    if (!state) return
    state.readOnly = inSelect
    unwatch?.()
    if (inSelect)
      unwatch = watch(
        () => state.readOnly,
        () => (state.readOnly = true)
      )
  })

  function enterBuilder() {
    if (!hasNodes.value) {
      emptyWorkflowDialog.show({
        onEnterBuilder: () => enterBuilder(),
        onDismiss: () => setMode('graph')
      })
      return
    }

    useSidebarTabStore().activeSidebarTabId = null

    setMode(
      mode.value === 'app' && hasOutputs.value
        ? 'builder:arrange'
        : 'builder:inputs'
    )
  }

  function exitBuilder() {
    resetSelectedToWorkflow()
    setMode('graph')
  }

  function removeSelectedInput(widget: IBaseWidget, node: { id: NodeId }) {
    const storeId = isPromotedWidgetView(widget) ? widget.sourceNodeId : node.id
    const storeName = isPromotedWidgetView(widget)
      ? widget.sourceWidgetName
      : widget.name
    const index = selectedInputs.findIndex(
      ([id, name]) => storeId == id && storeName === name
    )
    if (index !== -1) selectedInputs.splice(index, 1)
  }

  return {
    enterBuilder,
    exitBuilder,
    hasNodes,
    hasOutputs,
    pruneLinearData,
    removeSelectedInput,
    resetSelectedToWorkflow,
    selectedInputs,
    selectedOutputs
  }
})
