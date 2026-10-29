import type { IBaseWidget } from '@comfyorg/graph-model/widgets'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

interface ResolvedHostWidget {
  node: LGraphNode
  widget: IBaseWidget
}

export function resolveWidgetFromHostNode(
  hostNode: LGraphNode | undefined,
  widgetName: string
): ResolvedHostWidget | undefined {
  if (!hostNode) return undefined

  const widget = hostNode.widgets?.find((entry) => entry.name === widgetName)
  if (!widget) return undefined

  return { node: hostNode, widget }
}
