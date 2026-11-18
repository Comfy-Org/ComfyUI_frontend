import { LGraphEventMode } from '@comfyorg/graph-model/globalEnums'
import { graphScopeOf } from '@comfyorg/graph-model/graphScopeId'
import type { GraphScope } from '@comfyorg/graph-model/graphScopeId'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { NodeState } from '@comfyorg/graph-model/nodeState'
import { widgetId } from '@comfyorg/graph-model/widgetId'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'
import { PRIMITIVE_NODE_TYPE } from '@/constants/primitiveNodeConstants'
import { useLinkStore } from '@/stores/linkStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

export type InputValueSource =
  | {
      readonly kind: 'editable'
      readonly node: NodeState
      readonly widgetId: WidgetId
      readonly shared: boolean
    }
  | { readonly kind: 'linked'; readonly node: NodeState }
  | { readonly kind: 'unavailable' }

export type EditableInputValueSource = Extract<
  InputValueSource,
  { kind: 'editable' }
>

const passThroughTypes = new Set([
  'Reroute',
  'PrimitiveInt',
  'PrimitiveFloat',
  'PrimitiveString',
  'PrimitiveStringMultiline',
  'PrimitiveBoolean',
  PRIMITIVE_NODE_TYPE
])

function valueWidgetId(
  scope: GraphScope,
  node: NodeState
): WidgetId | undefined {
  const widgets = useWidgetValueStore()
  if (node.type === PRIMITIVE_NODE_TYPE)
    return widgets.getNodeWidgetIds(scope.rootGraphId, node.id)[0]
  const id = widgetId(scope.rootGraphId, node.id, 'value')
  return widgets.getWidget(id) && id
}

export function resolveInputValueSource(
  scope: GraphScope,
  host: NodeState,
  inputIndex: number,
  hostWidgetId: WidgetId
): InputValueSource {
  const links = useLinkStore()
  const nodes = useNodeDataStore()
  let link = links.getInputSlotLink(scope, host.id, inputIndex)
  if (!link)
    return {
      kind: 'editable',
      node: host,
      widgetId: hostWidgetId,
      shared: false
    }

  const seen = new Set<NodeId>()
  let shared = false
  while (!seen.has(link.originNodeId)) {
    seen.add(link.originNodeId)
    const node = nodes.getNode(scope.rootGraphId, link.originNodeId)
    if (!node) break
    shared ||=
      links.getOutputSlotLinks(scope, node.id, link.originSlot).size > 1
    if (
      node.mode !== LGraphEventMode.ALWAYS ||
      link.originSlot !== 0 ||
      !passThroughTypes.has(node.type)
    )
      return { kind: 'linked', node }
    const valueSlot =
      node.type === 'Reroute'
        ? 0
        : node.inputs.findIndex((input) => input.widget?.name === 'value')
    const upstream =
      valueSlot < 0
        ? undefined
        : links.getInputSlotLink(scope, node.id, valueSlot)
    if (upstream) {
      link = upstream
      continue
    }
    const id = valueWidgetId(scope, node)
    return id
      ? { kind: 'editable', node, widgetId: id, shared }
      : { kind: 'unavailable' }
  }
  return { kind: 'unavailable' }
}

/** Each widget input of {@link host}, keyed by input name, with the source its value is edited through. */
export function resolveInputValueSources(
  rootGraphId: string,
  host: NodeState
): Map<string, InputValueSource> {
  const scope = graphScopeOf({
    id: host.graphId,
    rootGraph: { id: rootGraphId }
  })
  return new Map(
    host.inputs.flatMap(({ name, widgetId }, index) =>
      widgetId
        ? [[name, resolveInputValueSource(scope, host, index, widgetId)]]
        : []
    )
  )
}
