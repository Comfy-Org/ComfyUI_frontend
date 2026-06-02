import { useEventListener } from '@vueuse/core'
import { computed, shallowRef, triggerRef } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { InputWidgetConfig } from '@/platform/workflow/management/stores/comfyWorkflow'
import { app } from '@/scripts/app'
import { useAppModeStore } from '@/stores/appModeStore'
import type { WidgetId } from '@/world/entityIds'
import { isWidgetId, parseWidgetId } from '@/world/entityIds'

export type ResolvedSelection =
  | {
      status: 'resolved'
      entityId: WidgetId
      node: LGraphNode
      widget: IBaseWidget
      displayName: string
      config?: InputWidgetConfig
    }
  | {
      status: 'unknown'
      entityId: WidgetId
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
      ([entityId, displayName, config]): ResolvedSelection[] => {
        if (!isWidgetId(entityId)) return []
        const { nodeId, name } = parseWidgetId(entityId)
        const node = rootGraph.getNodeById(nodeId)
        const widget = node?.widgets?.find((w) => w.name === name)
        if (!node || !widget) {
          return [{ status: 'unknown', entityId, displayName, config }]
        }
        return [
          { status: 'resolved', entityId, node, widget, displayName, config }
        ]
      }
    )
  })
}
