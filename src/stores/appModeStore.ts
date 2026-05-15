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
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import {
  getWidgetEntityIdForNode,
  resolveNode,
  resolveNodeWidget
} from '@/utils/litegraphUtil'
import type { WidgetEntityId } from '@/world/entityIds'
import { isWidgetEntityId, parseWidgetEntityId } from '@/world/entityIds'

/**
 * Resolve a widget by its canonical {@link WidgetEntityId} within the given
 * root graph. Identity comparison is purely structural —
 * `widget.entityId === entityId` — so producers and consumers never disagree
 * about which widget an id refers to.
 *
 * This is the single load-time resolution path; render-time consumers should
 * project `selectedInputs` through `useResolvedSelectedInputs` instead.
 */
function findWidgetByEntityId(
  rootGraph: LGraph,
  entityId: WidgetEntityId
): IBaseWidget | undefined {
  for (const node of rootGraph.nodes) {
    const widget = node.widgets?.find(
      (w) => getWidgetEntityIdForNode(node, w) === entityId
    )
    if (widget) return widget
  }
  return undefined
}

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

  function pruneLinearData(data: Partial<LinearData> | undefined): LinearData {
    const rawInputs = data?.inputs ?? []
    const rawOutputs = data?.outputs ?? []
    const rootGraph = app.rootGraph
    if (!rootGraph) {
      return { inputs: rawInputs, outputs: rawOutputs }
    }
    // Inputs always upgrade: `configured` fires after `LGraph.configure()` has
    // populated all nodes (LGraph.ts: dispatch in finally block), so legacy
    // tuples can be canonicalized even when `isLoadingGraph` is still true.
    // Without this, test-injected legacy `[nodeId, name]` tuples (and any
    // pre-WidgetEntityId persisted data) stay raw and get filtered out by
    // `useResolvedSelectedInputs`'s `isWidgetEntityId` guard, leaving the
    // app-mode widget list empty.
    //
    // Outputs pruning is deferred during loading: a transiently-missing node
    // (e.g. mid-reconfigure) would otherwise be silently dropped. Once the
    // load completes the next prune will trim any genuinely stale entries.
    return {
      inputs: rawInputs
        .map((input) => upgradeAndValidateInput(input, rootGraph))
        .filter((entry): entry is LinearInput => entry !== null),
      outputs: ChangeTracker.isLoadingGraph
        ? rawOutputs
        : rawOutputs.filter((nodeId) => resolveNode(nodeId))
    }
  }

  function buildEntry(
    entityId: WidgetEntityId,
    name: string,
    config: InputWidgetConfig | undefined
  ): LinearInput {
    return config === undefined ? [entityId, name] : [entityId, name, config]
  }

  function upgradeAndValidateInput(
    input: LinearInput,
    rootGraph: NonNullable<typeof app.rootGraph>
  ): LinearInput | null {
    const [storedId, widgetName, config] = input

    // Canonical: storedId is already a WidgetEntityId.
    if (typeof storedId === 'string' && isWidgetEntityId(storedId)) {
      const widget = findWidgetByEntityId(rootGraph, storedId)
      if (widget) return buildEntry(storedId, widgetName, config)
      // Keep dangling entries whose host node still exists (e.g. dynamic
      // widgets temporarily not visible) so the UI can surface them as
      // `status: 'unknown'`. Prune only when the node itself is gone.
      const { nodeId } = parseWidgetEntityId(storedId)
      if (rootGraph.getNodeById?.(nodeId)) {
        return buildEntry(storedId, widgetName, config)
      }
      return null
    }

    // Legacy NodeLocatorId (`graphId:nodeId`) for promoted widgets.
    if (typeof storedId === 'string' && storedId.includes(':')) {
      const [, widget] = resolveNodeWidget(storedId, widgetName)
      if (!widget?.entityId) return null
      return buildEntry(widget.entityId, widgetName, config)
    }

    // Legacy plain NodeId on root graph.
    const directNode = rootGraph.getNodeById?.(storedId)
    const directWidget = directNode?.widgets?.find((w) => w.name === widgetName)
    if (directNode && directWidget) {
      const derivedId = getWidgetEntityIdForNode(directNode, directWidget)
      if (derivedId) return buildEntry(derivedId, widgetName, config)
    }

    // Legacy plain NodeId for an interior source widget — promoted on a host.
    const matches: LinearInput[] = rootGraph.nodes.flatMap((node) => {
      if (!(node instanceof SubgraphNode)) return []
      return node.inputs.flatMap((inputSlot): LinearInput[] => {
        const widget = inputSlot._widget
        if (!widget || !isPromotedWidgetView(widget)) return []
        if (
          widget.sourceNodeId !== String(storedId) ||
          widget.sourceWidgetName !== widgetName
        ) {
          return []
        }
        return widget.entityId
          ? [buildEntry(widget.entityId, inputSlot.name, config)]
          : []
      })
    })
    if (matches.length === 1) return matches[0]
    if (matches.length > 1) {
      console.warn(
        '[appModeStore] dropping ambiguous legacy selectedInput tuple',
        { storedId, widgetName }
      )
      return null
    }

    console.warn(
      '[appModeStore] dropping legacy selectedInput tuple — no canonical identity available',
      { storedId, widgetName }
    )
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

    const source =
      activeWorkflow.changeTracker?.activeState?.extra?.linearData ??
      activeWorkflow.initialState?.extra?.linearData
    loadSelections(source)
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

  function removeSelectedInput(widget: IBaseWidget) {
    const targetEntityId = widget.entityId
    if (!targetEntityId) return
    const index = selectedInputs.value.findIndex(
      ([id]) => id === targetEntityId
    )
    if (index !== -1) selectedInputs.value.splice(index, 1)
  }

  function updateInputConfig(widget: IBaseWidget, config: InputWidgetConfig) {
    const targetEntityId = widget.entityId
    if (!targetEntityId) return
    const index = selectedInputs.value.findIndex(
      ([id]) => id === targetEntityId
    )
    if (index === -1) return
    // Replace the tuple rather than mutating its `[2]` slot in place so
    // reactive consumers that key off entry identity see the change.
    const [id, type, options] = selectedInputs.value[index]
    selectedInputs.value.splice(index, 1, [id, type, { ...options, ...config }])
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
