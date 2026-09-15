import { computed } from 'vue'

import { useAppMode } from '@/composables/useAppMode'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
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
import type { NodeState } from '@/types/nodeState'
import type { WidgetId } from '@/types/widgetId'
import {
  getNodeByLocatorId,
  locatorIdFromState
} from '@/utils/graphTraversalUtil'

export { computeProcessedWidgets }
export type { ProcessedWidget }

function getHostNode(nodeData: NodeState): LGraphNode | null {
  if (!app.isGraphReady) return null
  const locatorId = locatorIdFromState(nodeData, app.rootGraph.id)
  return locatorId ? getNodeByLocatorId(app.rootGraph, locatorId) : null
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
  const { getWidgetTooltip, createTooltipConfig } = useNodeTooltips(nodeType)

  const ui: WidgetUiCallbacks = {
    getTooltipConfig: (widget, fullValue = '') =>
      createTooltipConfig(
        [getWidgetTooltip(widget), fullValue].join('\n\n').trim()
      ),
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
