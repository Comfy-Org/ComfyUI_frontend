import type { LGraphEventMap } from '@comfyorg/graph-model/LGraphEventMap'

import type { LGraph } from '@/lib/litegraph/src/LGraph'

import { createHostEvent } from '@/platform/nodeApi/shared/hostEvent'
import { checkedFields } from '@/platform/nodeApi/v4/checkedFields'
import { checkedScope } from '@/platform/nodeApi/v4/nodeQuery'
import type { NodeHandles } from '@/platform/nodeApi/v4/nodeHandle'
import type {
  NodeChangeEvent,
  NodeChangeOptions,
  NodeHandle,
  NodeQueryScope,
  Unsubscribe
} from '@/platform/nodeApi/v4/types'
import { followGraphs } from './followGraphs'

type PropertyChange = CustomEvent<LGraphEventMap['node:property:changed']>

export function createNodeChanges(
  nodes: NodeHandles,
  visibleGraph: () => LGraph | null
): (
  listener: (event: NodeChangeEvent) => void,
  options?: NodeChangeOptions
) => Unsubscribe {
  const inScope = (scope: NodeQueryScope) =>
    createHostEvent<[NodeChangeEvent]>('onNodeChanged', (emit) =>
      followGraphs(scope, visibleGraph, (graph) =>
        reportChanges(graph, nodes, emit)
      )
    )
  const onVisibleChange = inScope('visible')
  const onAnyChange = inScope('root-and-subgraphs')

  return (listener, options = {}) =>
    scopeOf(options) === 'visible'
      ? onVisibleChange(listener)
      : onAnyChange(listener)
}

function scopeOf(options: unknown): NodeQueryScope {
  const { scope } = checkedFields('onNodeChanged', 'options', options, {
    scope: true
  })
  return checkedScope('onNodeChanged', scope)
}

function reportChanges(
  graph: LGraph,
  nodes: NodeHandles,
  emit: (event: NodeChangeEvent) => void
): () => void {
  const onPropertyChanged = ({ detail }: PropertyChange) => {
    const node = nodes.find(graph, String(detail.nodeId))
    const change = node && changeOf(node, graph.id, detail.property)
    if (change) emit(Object.freeze(change))
  }
  graph.events.addEventListener('node:property:changed', onPropertyChanged)
  return () =>
    graph.events.removeEventListener('node:property:changed', onPropertyChanged)
}

function changeOf(
  node: NodeHandle,
  graphId: string,
  hostProperty: string
): NodeChangeEvent | undefined {
  switch (hostProperty) {
    case 'title':
      return { node, graphId, property: 'title', to: node.getTitle() }
    case 'mode':
      return { node, graphId, property: 'mode', to: node.getMode() }
    case 'color':
      return { node, graphId, property: 'color', to: node.getColor() }
    case 'bgcolor':
      return { node, graphId, property: 'bgColor', to: node.getBgColor() }
  }
  return undefined
}
