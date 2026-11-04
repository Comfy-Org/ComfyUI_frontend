import { parseNodeId } from '@comfyorg/graph-model/nodeId'

import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode } from '@/lib/litegraph/src/litegraph'
import type {
  AppWidgetResolver,
  ResolvedAppOutput,
  ResolvedAppWidget
} from '@/renderer/extensions/superComfy/apps/appWidgetResolver'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { resolveNodeWidget } from '@/utils/litegraphUtil'

function widgetSlotIndex(node: LGraphNode, widgetName: string): number {
  return node.inputs.findIndex((input) => input.widget?.name === widgetName)
}

function resolveWidget(
  graph: LGraph,
  nodeId: string,
  widgetName: string
): ResolvedAppWidget | null {
  const [node, widget] = resolveNodeWidget(nodeId, widgetName, graph)
  if (!node || !widget) return null
  const slot = widgetSlotIndex(node, widgetName)
  const input = slot >= 0 ? node.inputs[slot] : undefined
  return {
    nodeType: node.type,
    mode: node.mode === LGraphEventMode.ALWAYS ? 'always' : 'other',
    linked: slot >= 0 && node.isInputConnected(slot),
    label: input?.label ?? widget.label ?? widgetName,
    value: widget.value,
    spec: useNodeDefStore().getInputSpecForWidget(node, widgetName)
  }
}

function resolveOutput(
  graph: LGraph,
  nodeId: string
): ResolvedAppOutput | null {
  const node = graph.getNodeById(parseNodeId(nodeId))
  if (!node) return null
  return {
    nodeId,
    nodeType: node.type,
    label: node.title || node.type,
    inputTypes: node.inputs.map((input) => String(input.type))
  }
}

export function createGraphResolver(graph: LGraph): AppWidgetResolver {
  return {
    widget: (nodeId, widgetName) => resolveWidget(graph, nodeId, widgetName),
    output: (nodeId) => resolveOutput(graph, nodeId)
  }
}
