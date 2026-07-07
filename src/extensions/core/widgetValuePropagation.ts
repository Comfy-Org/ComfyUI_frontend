import type { Point } from '@/lib/litegraph/src/interfaces'
import type { LLink } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { CanvasPointerEvent } from '@/lib/litegraph/src/types/events'
import { app } from '@/scripts/app'
import { useLinkStore } from '@/stores/linkStore'
import { UNASSIGNED_NODE_ID } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'
import type { WidgetValue } from '@/types/simplifiedWidget'

type SourceNode = Pick<LGraphNode, 'id' | 'graph' | 'widgets'>

interface TargetEndpoint {
  targetNodeId: NodeId
  targetSlot: number
}

export function applyFirstWidgetValueToGraph(
  node: SourceNode,
  extraLinks: LLink[] = [],
  transformValue?: (value: WidgetValue) => WidgetValue
) {
  const { graph } = node
  if (!graph) return

  const linked = [
    ...useLinkStore().getOutputSlotLinks(graph.rootGraph.id, node.id, 0)
  ].filter((topology) => topology.targetNodeId !== UNASSIGNED_NODE_ID)
  if (!linked.length) return

  const sourceWidget = node.widgets?.[0]
  if (!sourceWidget) return

  let value = sourceWidget.value
  if (transformValue) {
    value = transformValue(value)
  }

  const graphMouse: Point = app.canvas?.graph_mouse ?? [0, 0]

  const endpoints: TargetEndpoint[] = [
    ...linked.map(({ targetNodeId, targetSlot }) => ({
      targetNodeId,
      targetSlot
    })),
    ...extraLinks.map((link) => ({
      targetNodeId: link.target_id,
      targetSlot: link.target_slot
    }))
  ]

  for (const endpoint of endpoints) {
    const targetNode = graph.getNodeById(endpoint.targetNodeId)
    const input = targetNode?.inputs[endpoint.targetSlot]
    if (!targetNode || !input) {
      console.warn('Unable to resolve node or input for link', endpoint)
      continue
    }

    const widgetName = input.widget?.name
    if (!widgetName) {
      console.warn('Invalid widget or widget name', input.widget)
      continue
    }

    const targetWidget = targetNode.widgets?.find(
      (widget) => widget.name === widgetName
    )
    if (!targetWidget) {
      console.warn(
        `Unable to find widget "${widgetName}" on node [${targetNode.id}]`
      )
      continue
    }

    targetWidget.value = value
    targetWidget.callback?.(
      targetWidget.value,
      app.canvas,
      targetNode,
      graphMouse,
      {} as CanvasPointerEvent
    )
  }
}
