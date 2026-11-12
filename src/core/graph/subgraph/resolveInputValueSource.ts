import type { GraphScope } from '@comfyorg/graph-model/graphScopeId'
import { LGraphEventMode } from '@comfyorg/graph-model/globalEnums'
import type { NodeState } from '@comfyorg/graph-model/nodeState'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'
import type { LinkTopology } from '@comfyorg/graph-model/linkTopology'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { WidgetState } from '@comfyorg/graph-model/widgetState'

export interface ValueSourceGraph {
  readonly scope: GraphScope
  readonly nodes: ReadonlyMap<NodeId, NodeState>
  readonly inputLink: (
    node: NodeState,
    index: number
  ) => LinkTopology | undefined
  readonly widgetIds: (node: NodeState) => readonly WidgetId[]
  readonly widget: (id: WidgetId) => WidgetState | undefined
}

export type InputValueSource =
  | {
      readonly kind: 'editable'
      readonly node: NodeState
      readonly widgetId: WidgetId
    }
  | { readonly kind: 'linked'; readonly node?: NodeState }
  | { readonly kind: 'unavailable' }

const primitiveTypes = new Set([
  'PrimitiveInt',
  'PrimitiveFloat',
  'PrimitiveString',
  'PrimitiveStringMultiline',
  'PrimitiveBoolean',
  'PrimitiveNode'
])

type SourceStep = InputValueSource | { kind: 'upstream'; link: LinkTopology }

function resolvePrimitiveSource(
  graph: ValueSourceGraph,
  node: NodeState
): SourceStep {
  const id = graph
    .widgetIds(node)
    .find(
      (id) =>
        node.type === 'PrimitiveNode' || graph.widget(id)?.name === 'value'
    )
  const widget = id ? graph.widget(id) : undefined
  if (!widget || !id) return { kind: 'unavailable' }
  const index = node.inputs.findIndex(
    (entry) => entry.widget?.name === widget.name
  )
  const upstream = index < 0 ? undefined : graph.inputLink(node, index)
  return upstream
    ? { kind: 'upstream', link: upstream }
    : { kind: 'editable', node, widgetId: id }
}

function resolveNodeSource(
  graph: ValueSourceGraph,
  node: NodeState,
  link: LinkTopology
): SourceStep {
  if (node.mode !== LGraphEventMode.ALWAYS || link.originSlot !== 0) {
    return { kind: 'linked', node }
  }
  if (node.type === 'Reroute') {
    const upstream = graph.inputLink(node, 0)
    return upstream
      ? { kind: 'upstream', link: upstream }
      : { kind: 'unavailable' }
  }
  return primitiveTypes.has(node.type)
    ? resolvePrimitiveSource(graph, node)
    : { kind: 'linked', node }
}

export function resolveInputValueSource(
  graph: ValueSourceGraph,
  host: NodeState,
  inputName: string
): InputValueSource {
  const input = host.inputs.find((input) => input.name === inputName)
  if (!input) return { kind: 'unavailable' }
  let link = graph.inputLink(host, host.inputs.indexOf(input))
  if (!link)
    return input.widgetId
      ? { kind: 'editable', node: host, widgetId: input.widgetId }
      : { kind: 'unavailable' }

  const seen = new Set<NodeState>()
  for (;;) {
    const node = graph.nodes.get(link.originNodeId)
    if (!node || node.graphId !== graph.scope.owningGraphId || seen.has(node)) {
      return { kind: 'unavailable' }
    }
    seen.add(node)
    const step = resolveNodeSource(graph, node, link)
    if (step.kind !== 'upstream') return step
    link = step.link
  }
}
