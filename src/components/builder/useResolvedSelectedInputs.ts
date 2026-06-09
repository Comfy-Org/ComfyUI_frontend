import { useEventListener } from '@vueuse/core'
import { computed, shallowRef, triggerRef } from 'vue'

import { promotedInputWidgets } from '@/core/graph/subgraph/promotedInputWidget'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { InputWidgetConfig } from '@/platform/workflow/management/stores/comfyWorkflow'
import { app } from '@/scripts/app'
import { useAppModeStore } from '@/stores/appModeStore'
import type { WidgetId } from '@/types/widgetId'
import { isWidgetId, parseWidgetId } from '@/types/widgetId'

export type ResolvedSelection =
  | {
      status: 'resolved'
      widgetId: WidgetId
      node: LGraphNode
      widget: IBaseWidget
      displayName: string
      config?: InputWidgetConfig
    }
  | {
      status: 'unknown'
      widgetId: WidgetId
      displayName: string
      config?: InputWidgetConfig
    }

export function useResolvedSelectedInputs() {
  const appModeStore = useAppModeStore()

  const graphNodes = shallowRef<LGraphNode[]>([...(app.rootGraph?.nodes ?? [])])
  const refreshGraphNodes = () =>
    (graphNodes.value = [...(app.rootGraph?.nodes ?? [])])
  useEventListener(() => app.rootGraph?.events, 'configured', refreshGraphNodes)
  useEventListener(
    () => app.rootGraph?.events,
    'convert-to-subgraph',
    refreshGraphNodes
  )
  useEventListener(
    () => app.rootGraph?.events,
    'subgraph-created',
    refreshGraphNodes
  )
  useEventListener(
    () => app.rootGraph?.events,
    'node:slot-label:changed',
    () => triggerRef(graphNodes)
  )

  return computed<ResolvedSelection[]>(() => {
    void graphNodes.value
    const rootGraph = app.rootGraph
    if (!rootGraph) return []

    return appModeStore.selectedInputs.flatMap(
      ([widgetId, displayName, config]): ResolvedSelection[] => {
        if (!isWidgetId(widgetId)) return []
        const { nodeId, name } = parseWidgetId(widgetId)
        const node = rootGraph.getNodeById(nodeId)
        const widgets = node?.isSubgraphNode()
          ? promotedInputWidgets(node)
          : node?.widgets
        const widget = widgets?.find((w) => w.name === name)
        if (!node || !widget) {
          return [{ status: 'unknown', widgetId, displayName, config }]
        }
        return [
          { status: 'resolved', widgetId, node, widget, displayName, config }
        ]
      }
    )
  })
}
