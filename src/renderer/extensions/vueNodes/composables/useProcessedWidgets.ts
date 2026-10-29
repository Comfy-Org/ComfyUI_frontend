import { computed } from 'vue'

import { useAppMode } from '@/composables/useAppMode'
import type { LGraphNode } from '@comfyorg/litegraph/litegraph'
import { LGraphEventMode } from '@comfyorg/graph-model/globalEnums'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import type {
  ProcessedWidget,
  WidgetUiCallbacks
} from '@/renderer/extensions/vueNodes/composables/processedWidgetRenderModel'
import { computeProcessedWidgets } from '@/renderer/extensions/vueNodes/composables/processedWidgetRenderModel'
import { useNodeEventHandlers } from '@/renderer/extensions/vueNodes/composables/useNodeEventHandlers'
import { useNodeTooltips } from '@/renderer/extensions/vueNodes/composables/useNodeTooltips'
import { nodeHasError } from '@/renderer/extensions/vueNodes/utils/nodeErrorState'
import { app } from '@/scripts/app'
import { nodeTypeValidForApp } from '@/stores/appModeStore'
import type { NodeState } from '@comfyorg/graph-model/nodeState'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'
import { getNodeByState } from '@comfyorg/litegraph/utils/graphTraversalUtil'

export { computeProcessedWidgets }
export type { ProcessedWidget }

function getHostNode(nodeData: NodeState): LGraphNode | null {
  if (!app.isGraphReady) return null
  return getNodeByState(app.rootGraph, nodeData)
}

export function useProcessedWidgets(
  nodeDataGetter: () => NodeState | undefined,
  widgetIdsGetter: () => readonly WidgetId[] | undefined = () => undefined
) {
  const canvasStore = useCanvasStore()
  const settingStore = useSettingStore()
  const { isSelectInputsMode } = useAppMode()
  const { handleNodeRightClick } = useNodeEventHandlers()

  const nodeType = computed(() => nodeDataGetter()?.type || '')
  const { getWidgetTooltip } = useNodeTooltips(nodeType)

  const ui: WidgetUiCallbacks = {
    getTooltipText: getWidgetTooltip,
    handleNodeRightClick
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
      isGraphReady: app.isGraphReady,
      rootGraph: app.isGraphReady ? app.rootGraph : null,
      ui
    })
  )

  return {
    canSelectInputs,
    nodeType,
    processedWidgets
  }
}
