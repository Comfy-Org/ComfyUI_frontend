import type { LLink } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { CanvasPointerEvent } from '@/lib/litegraph/src/types/events'
import type { TWidgetValue } from '@/lib/litegraph/src/types/widgets'
import { app } from '@/scripts/app'

type SourceNode = Pick<LGraphNode, 'graph' | 'outputs' | 'widgets'>

export function applyFirstWidgetValueToGraph(
  node: SourceNode,
  extraLinks: LLink[] = [],
  transformValue?: (value: TWidgetValue) => TWidgetValue
) {
  const output = node.outputs[0]
  if (!output?.links?.length || !node.graph) return

  const sourceWidget = node.widgets?.[0]
  if (!sourceWidget) return

  let value = sourceWidget.value
  if (transformValue) {
    value = transformValue(value)
  }

  const graphMouse = app.canvas?.graph_mouse ?? ({} as CanvasPointerEvent)

  const links = [
    ...output.links.map((linkId) => node.graph!.links[linkId]),
    ...extraLinks
  ]

  for (const linkInfo of links) {
    if (!linkInfo) continue

    const targetNode = node.graph.getNodeById(linkInfo.target_id)
    const input = targetNode?.inputs[linkInfo.target_slot]
    if (!targetNode || !input) {
      console.warn('Unable to resolve node or input for link', linkInfo)
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
