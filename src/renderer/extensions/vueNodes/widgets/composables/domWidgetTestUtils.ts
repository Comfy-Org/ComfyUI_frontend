import { beforeEach } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { DOMWidgetImpl } from '@/scripts/domWidget'
import { toNodeId } from '@comfyorg/graph-model/nodeId'

type NodeOverrides = Partial<
  Pick<LGraphNode, 'id' | 'type' | 'size' | 'imgs' | 'graph'>
>

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

export function createDOMWidgetNode(overrides: NodeOverrides = {}) {
  const { graph, type, ...properties } = overrides
  const node = new LGraphNode('Test', type)
  node.widgets = []
  Object.assign(node, { id: toNodeId(1) }, properties)
  graph?.add(node)
  nodes.push(node)
  return node
}

class SilentValueDOMWidget<
  T extends HTMLElement,
  V extends object | string
> extends DOMWidgetImpl<T, V> {
  override get value(): V {
    return super.value
  }

  override set value(value: V) {
    this.options.setValue?.(value)
  }
}

export function stubWidgetValueCallbacks(node: LGraphNode) {
  node.addDOMWidget = (name, type, element, options = {}) => {
    const widget = new SilentValueDOMWidget({
      node,
      name,
      type,
      element,
      options
    })
    node.addCustomWidget(widget)
    return widget
  }
}
