import { LGraphEventMode } from '@comfyorg/graph-model/globalEnums'
import type { GraphScope } from '@comfyorg/graph-model/graphScopeId'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { NodeState } from '@comfyorg/graph-model/nodeState'
import { widgetId } from '@comfyorg/graph-model/widgetId'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'
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

const passThroughTypes = new Set([
  'Reroute',
  'PrimitiveInt',
  'PrimitiveFloat',
  'PrimitiveString',
  'PrimitiveStringMultiline',
  'PrimitiveBoolean',
  'PrimitiveNode'
])

function valueWidgetId(
  scope: GraphScope,
  node: NodeState
): WidgetId | undefined {
  const widgets = useWidgetValueStore()
  if (node.type === 'PrimitiveNode')
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
    const node = nodes.getNode(scope, link.originNodeId)
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
