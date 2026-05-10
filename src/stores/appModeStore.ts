import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useEventListener } from '@vueuse/core'

import { useEmptyWorkflowDialog } from '@/components/builder/useEmptyWorkflowDialog'
import { useAppMode } from '@/composables/useAppMode'
import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type {
  InputWidgetConfig,
  LinearData,
  LinearInput
} from '@/platform/workflow/management/stores/comfyWorkflow'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
import { app } from '@/scripts/app'
import { ChangeTracker } from '@/scripts/changeTracker'
import { isPromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetTypes'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { createNodeLocatorId } from '@/types/nodeIdentification'
import { resolveNode, resolveNodeWidget } from '@/utils/litegraphUtil'

export function nodeTypeValidForApp(type: string) {
  return !['Note', 'MarkdownNote'].includes(type)
}

export const useAppModeStore = defineStore('appMode', () => {
  const { getCanvas } = useCanvasStore()
  const settingStore = useSettingStore()
  const workflowStore = useWorkflowStore()
  const { mode, setMode, isBuilderMode, isSelectMode } = useAppMode()
  const emptyWorkflowDialog = useEmptyWorkflowDialog()

  const showVueNodeSwitchPopup = ref(false)

  const selectedInputs = ref<LinearInput[]>([])
  const selectedOutputs = ref<NodeId[]>([])
  const hasOutputs = computed(() => !!selectedOutputs.value.length)
  const hasNodes = computed(() => {
    // Nodes are not reactive, so trigger recomputation when workflow changes
    void workflowStore.activeWorkflow
    void mode.value
    return !!app.rootGraph?.nodes?.length
  })

  // Prune entries referencing nodes deleted in workflow mode.
  // Only check node existence, not widgets — dynamic widgets can
  // hide/show other widgets so a missing widget does not mean stale data.
  // ADR 0009: also performs the one-shot legacy-tuple migration that
  // projects pre-ratchet `(sourceNodeId, sourceWidgetName)` selections
  // through the new host-scoped `(hostNodeLocator, subgraphInputName)`
  // identity. Failed projections are dropped with `console.warn`.
  function pruneLinearData(data: Partial<LinearData> | undefined): LinearData {
    const rawInputs = data?.inputs ?? []
    const rawOutputs = data?.outputs ?? []

    return {
      inputs: app.rootGraph
        ? rawInputs
            .map(migrateLegacyInputTuple)
            .filter((entry): entry is LinearInput => entry !== null)
            .filter(selectedInputExists)
        : rawInputs,
      outputs: app.rootGraph
        ? rawOutputs.filter((nodeId) => resolveNode(nodeId))
        : rawOutputs
    }
  }

  function selectedInputExists([nodeId, widgetName]: LinearInput): boolean {
    if (typeof nodeId === 'string' && nodeId.includes(':')) {
      if (typeof app.rootGraph?.getNodeById !== 'function') return true
      const [, widget] = resolveNodeWidget(nodeId, widgetName)
      return Boolean(widget)
    }
    return Boolean(resolveNode(nodeId))
  }

  /**
   * If a legacy tuple references the interior `(sourceNodeId, widgetName)`
   * of a now-promoted widget, project it through the wrapping host
   * SubgraphNode's locator + subgraph-input name.
   */
  function migrateLegacyInputTuple(input: LinearInput): LinearInput | null {
    const [storedId, widgetName] = input
    if (typeof storedId === 'string' && storedId.includes(':')) {
      // Already in `(hostNodeLocator, subgraphInputName)` form.
      return input
    }

    if (directRootWidgetExists(storedId, widgetName)) return input

    const projection = projectLegacyTupleThroughHost(storedId, widgetName)
    if (projection) {
      return [projection.hostLocator, projection.subgraphInputName, input[2]]
    }

    if (resolveNode(storedId)) return input

    console.warn(
      '[appModeStore] dropping legacy selectedInput tuple — no canonical identity available',
      { storedId, widgetName }
    )
    return null
  }

  function directRootWidgetExists(nodeId: NodeId, widgetName: string): boolean {
    const node = app.rootGraph?.getNodeById?.(nodeId)
    return Boolean(node?.widgets?.some((widget) => widget.name === widgetName))
  }

  function projectLegacyTupleThroughHost(
    legacySourceNodeId: NodeId,
    legacyWidgetName: string
  ): { hostLocator: string; subgraphInputName: string } | null {
    const rootGraph = app.rootGraph
    if (!rootGraph) return null

    const matches: Array<{ hostLocator: string; subgraphInputName: string }> =
      []

    for (const node of rootGraph.nodes) {
      if (!(node instanceof SubgraphNode)) continue

      for (const inputSlot of node.inputs) {
        const widget = inputSlot._widget
        if (!widget || !isPromotedWidgetView(widget)) continue
        if (
          widget.sourceNodeId === String(legacySourceNodeId) &&
          widget.sourceWidgetName === legacyWidgetName
        ) {
          matches.push({
            hostLocator: createNodeLocatorId(rootGraph.id, node.id),
            subgraphInputName: inputSlot.name
          })
        }
      }
    }

    if (matches.length === 1) return matches[0]
    if (matches.length > 1) {
      console.warn(
        '[appModeStore] dropping ambiguous legacy selectedInput tuple',
        { storedId: legacySourceNodeId, widgetName: legacyWidgetName }
      )
    }
    return null
  }

  function loadSelections(data: Partial<LinearData> | undefined) {
    const { inputs, outputs } = pruneLinearData(data)
    selectedInputs.value = inputs
    selectedOutputs.value = outputs
  }

  function resetSelectedToWorkflow() {
    const { activeWorkflow } = workflowStore
    if (!activeWorkflow) return

    loadSelections(activeWorkflow.changeTracker?.activeState?.extra?.linearData)
  }

  useEventListener(
    () => app.rootGraph?.events,
    'configured',
    resetSelectedToWorkflow
  )

  watch(
    () =>
      isBuilderMode.value
        ? { inputs: selectedInputs.value, outputs: selectedOutputs.value }
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
      workflowStore.activeWorkflow?.changeTracker?.captureCanvasState()
    },
    { deep: true }
  )

  let unwatchReadOnly: (() => void) | undefined
  function enforceReadOnly(inSelect: boolean) {
    const { state } = getCanvas()
    if (!state) return
    state.readOnly = inSelect
    unwatchReadOnly?.()
    if (inSelect)
      unwatchReadOnly = watch(
        () => state.readOnly,
        () => (state.readOnly = true)
      )
  }

  function autoEnableVueNodes(inSelect: boolean) {
    if (!inSelect) return
    if (!settingStore.get('Comfy.VueNodes.Enabled')) {
      void settingStore.set('Comfy.VueNodes.Enabled', true)

      if (!settingStore.get('Comfy.AppBuilder.VueNodeSwitchDismissed')) {
        showVueNodeSwitchPopup.value = true
      }
    }
  }

  watch(isSelectMode, (inSelect) => {
    enforceReadOnly(inSelect)
    autoEnableVueNodes(inSelect)
  })

  function enterBuilder() {
    if (!hasNodes.value) {
      emptyWorkflowDialog.show({
        onEnterBuilder: () => enterBuilder(),
        onDismiss: () => setMode('graph')
      })
      return
    }

    // Prune stale references
    resetSelectedToWorkflow()

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
    // ADR 0009: promoted widgets identify by `(hostNodeLocator,
    // subgraphInputName)` so that two host SubgraphNodes wrapping the same
    // Subgraph definition retain independent selections.
    const rootGraphId = app.rootGraph?.id
    const isPromoted = isPromotedWidgetView(widget)
    const storeId =
      isPromoted && rootGraphId
        ? createNodeLocatorId(rootGraphId, node.id)
        : node.id
    const storeName = widget.name
    const index = selectedInputs.value.findIndex(
      ([id, name]) => storeId == id && storeName === name
    )
    if (index !== -1) selectedInputs.value.splice(index, 1)
  }

  function updateInputConfig(
    nodeId: NodeId,
    widgetName: string,
    config: InputWidgetConfig
  ) {
    const entry = selectedInputs.value.find(
      ([id, name]) => nodeId == id && widgetName === name
    )
    if (!entry) return
    entry[2] = { ...entry[2], ...config }
  }

  return {
    enterBuilder,
    exitBuilder,
    hasNodes,
    hasOutputs,
    loadSelections,
    pruneLinearData,
    removeSelectedInput,
    resetSelectedToWorkflow,
    selectedInputs,
    selectedOutputs,
    updateInputConfig,
    showVueNodeSwitchPopup
  }
})
