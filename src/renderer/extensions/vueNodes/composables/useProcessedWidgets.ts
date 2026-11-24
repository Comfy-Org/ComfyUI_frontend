import { computed } from 'vue'

import { useAppMode } from '@/composables/useAppMode'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode } from '@comfyorg/graph-model/globalEnums'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import type {
  ProcessedWidget,
  WidgetUiCallbacks
} from '@/renderer/extensions/vueNodes/composables/processedWidgetRenderModel'
import {
  computeInputRows,
  computeProcessedWidgets,
  withInputRows
} from '@/renderer/extensions/vueNodes/composables/processedWidgetRenderModel'
import { useNodeEventHandlers } from '@/renderer/extensions/vueNodes/composables/useNodeEventHandlers'
import { useNodeTooltips } from '@/renderer/extensions/vueNodes/composables/useNodeTooltips'
import { nodeHasError } from '@/renderer/extensions/vueNodes/utils/nodeErrorState'
import { useApp } from '@/scripts/appInstance'
import { nodeTypeValidForApp } from '@/stores/appModeStore'
import type { NodeState } from '@comfyorg/graph-model/nodeState'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'
import { getNodeByState } from '@/utils/graphTraversalUtil'

export { computeProcessedWidgets }
export type { ProcessedWidget }

function getHostNode(nodeData: NodeState): LGraphNode | null {
  if (!useApp().isGraphReady) return null
  return getNodeByState(useApp().rootGraph, nodeData)
}

export function useProcessedWidgets(
  nodeDataGetter: () => NodeState | undefined,
  widgetIdsGetter: () => readonly WidgetId[] | undefined = () => undefined,
  { contextMenu = true }: { contextMenu?: boolean } = {}
) {
  const canvasStore = useCanvasStore()
  const settingStore = useSettingStore()
  const { isSelectInputsMode } = useAppMode()
  const { handleNodeRightClick } = useNodeEventHandlers()

  const nodeType = computed(() => nodeDataGetter()?.type || '')
  const { getWidgetTooltip } = useNodeTooltips(nodeType)

  const ui: WidgetUiCallbacks = {
    getTooltipText: getWidgetTooltip,
    handleNodeRightClick: contextMenu ? handleNodeRightClick : undefined
  }

  const showAdvanced = computed(
    () =>
      nodeDataGetter()?.showAdvanced ||
      settingStore.get('Comfy.Node.AlwaysShowAdvancedWidgets')
  )

  const canSelectInputs = computed(() => {
    const nodeData = nodeDataGetter()
    if (!nodeData) return false
    return (
      isSelectInputsMode.value &&
      nodeData.mode === LGraphEventMode.ALWAYS &&
      nodeTypeValidForApp(nodeData.type) &&
      !nodeHasError(nodeData, canvasStore.rootGraphId, getHostNode(nodeData))
    )
  })

  const processedWidgets = computed((): ProcessedWidget[] =>
    computeProcessedWidgets({
      nodeData: nodeDataGetter(),
      widgetIds: widgetIdsGetter(),
      graphId: canvasStore.rootGraphId,
      showAdvanced: showAdvanced.value,
      isGraphReady: useApp().isGraphReady,
      rootGraph: useApp().isGraphReady ? useApp().rootGraph : null,
      ui
    })
  )

  const inputRows = computed(() =>
    computeInputRows(
      nodeDataGetter(),
      useApp().isGraphReady ? useApp().rootGraph : null
    )
  )

  const gridRows = computed(() =>
    withInputRows(processedWidgets.value, inputRows.value)
  )

  return {
    canSelectInputs,
    gridRows,
    nodeType,
    processedWidgets
  }
}
