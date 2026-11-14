import { LGraphEventMode } from '@comfyorg/graph-model/globalEnums'
import type { NodeState } from '@comfyorg/graph-model/nodeState'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'
import type { LinkTopology } from '@comfyorg/graph-model/linkTopology'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { WidgetState } from '@comfyorg/graph-model/widgetState'

export interface ValueSourceGraph {
  readonly nodes: ReadonlyMap<NodeId, NodeState>
  readonly inputLink: (
    node: NodeState,
    index: number
  ) => LinkTopology | undefined
  readonly widgetIds: (node: NodeState) => readonly WidgetId[]
  readonly widget: (id: WidgetId) => WidgetState | undefined
  readonly outputLinkCount: (node: NodeState, index: number) => number
}

export type InputValueSource =
  | {
      readonly kind: 'editable'
      readonly node: NodeState
      readonly widgetId: WidgetId
      readonly shared: boolean
    }
  | { readonly kind: 'linked'; readonly node: NodeState }
  | { readonly kind: 'unavailable' }

const primitiveTypes = new Set([
  'PrimitiveInt',
  'PrimitiveFloat',
  'PrimitiveString',
  'PrimitiveStringMultiline',
  'PrimitiveBoolean',
  'PrimitiveNode'
])

interface ValueStep {
  readonly widgetId?: WidgetId
  readonly upstream?: LinkTopology
}

function primitiveValueStep(
  graph: ValueSourceGraph,
  node: NodeState
): ValueStep | undefined {
  const widgetId = graph
    .widgetIds(node)
    .find(
      (id) =>
        node.type === 'PrimitiveNode' || graph.widget(id)?.name === 'value'
    )
  if (!widgetId) return undefined
  const index = node.inputs.findIndex((entry) => entry.widget?.name === 'value')
  return {
    widgetId,
    upstream: index < 0 ? undefined : graph.inputLink(node, index)
  }
}

function valueStep(
  graph: ValueSourceGraph,
  node: NodeState
): ValueStep | undefined {
  return node.type === 'Reroute'
    ? { upstream: graph.inputLink(node, 0) }
    : primitiveValueStep(graph, node)
}

function passesValueThrough(node: NodeState, link: LinkTopology): boolean {
  return (
    node.mode === LGraphEventMode.ALWAYS &&
    link.originSlot === 0 &&
    (node.type === 'Reroute' || primitiveTypes.has(node.type))
  )
}

export function resolveInputValueSource(
  graph: ValueSourceGraph,
  host: NodeState,
  inputIndex: number,
  hostWidgetId: WidgetId
): InputValueSource {
  let link = graph.inputLink(host, inputIndex)
  if (!link)
    return {
      kind: 'editable',
      node: host,
      widgetId: hostWidgetId,
      shared: false
    }

  const seen = new Set<NodeState>()
  let shared = false
  for (;;) {
    const node = graph.nodes.get(link.originNodeId)
    if (!node || seen.has(node)) return { kind: 'unavailable' }
    seen.add(node)
    shared ||= graph.outputLinkCount(node, link.originSlot) > 1
    if (!passesValueThrough(node, link)) return { kind: 'linked', node }
    const step = valueStep(graph, node)
    if (step?.upstream) {
      link = step.upstream
      continue
    }
    return step?.widgetId
      ? { kind: 'editable', node, widgetId: step.widgetId, shared }
      : { kind: 'unavailable' }
  }
}
