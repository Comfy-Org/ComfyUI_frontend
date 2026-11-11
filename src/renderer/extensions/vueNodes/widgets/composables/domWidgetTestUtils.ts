import { beforeEach } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { toNodeId } from '@comfyorg/graph-model/nodeId'

type NodeOverrides = Partial<
  Pick<LGraphNode, 'id' | 'type' | 'size' | 'imgs' | 'graph'>
>

export function useDOMWidgetTestNodes() {
  let nodes: LGraphNode[]

  beforeEach(() => {
    const ownedNodes: LGraphNode[] = []
    nodes = ownedNodes
    return () => {
      for (const node of ownedNodes) {
        for (const widget of node.widgets ?? []) widget.onRemove?.()
      }
    }
  })

  return (overrides: NodeOverrides = {}) => {
    const { graph, type, ...properties } = overrides
    const node = new LGraphNode('Test', type)
    node.widgets = []
    Object.assign(node, { id: toNodeId(1) }, properties)
    graph?.add(node)
    nodes.push(node)
    return node
  }
}
