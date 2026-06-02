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
import {
  isWidgetEntityId,
  parseLegacyWidgetEntityId,
  parseWidgetEntityId
} from '@/world/entityIds'

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

    if (typeof storedId === 'string' && isWidgetEntityId(storedId)) {
      const widget = findWidgetByEntityId(rootGraph, storedId)
      if (widget) return buildEntry(storedId, widgetName, config)
      const { nodeId } = parseWidgetEntityId(storedId)
      if (rootGraph.getNodeById?.(nodeId)) {
        return buildEntry(storedId, widgetName, config)
      }
      return null
    }

    if (typeof storedId === 'string') {
      const legacyId = parseLegacyWidgetEntityId(storedId, rootGraph.id)
      if (legacyId) {
        const node = rootGraph.getNodeById?.(legacyId.nodeId)
        const widget = node?.widgets?.find((w) => w.name === legacyId.name)
        const entityId =
          node && widget && getWidgetEntityIdForNode(node, widget)
        return entityId ? buildEntry(entityId, widgetName, config) : null
      }
    }

    if (typeof storedId === 'string' && storedId.includes(':')) {
      const [, widget] = resolveNodeWidget(storedId, widgetName)
      if (!widget?.entityId) return null
      return buildEntry(widget.entityId, widgetName, config)
    }

    const directNode = rootGraph.getNodeById?.(storedId)
    const directWidget = directNode?.widgets?.find((w) => w.name === widgetName)
    if (directNode && directWidget) {
      const derivedId = getWidgetEntityIdForNode(directNode, directWidget)
      if (derivedId) return buildEntry(derivedId, widgetName, config)
    }

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
