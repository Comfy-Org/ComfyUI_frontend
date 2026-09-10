import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph } from '@/lib/litegraph/src/LGraph'
import { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type { TWidgetType } from '@/lib/litegraph/src/types/widgets'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import { toNodeId } from '@/types/nodeId'

import { applyLiveWidgetValue } from './liveWidgetProjection'

const rootScope = {
  rootGraphId: toRootGraphId('root'),
  owningGraphId: toOwningGraphId('root')
}

function graphWithWidget(type: TWidgetType = 'text') {
  const graph = new LGraph()
  graph.id = 'root'
  const node = new LGraphNode('Test')
  node.id = toNodeId(7)
  const callback = vi.fn()
  const widget = node.addWidget(type, 'value', 'before', callback)
  graph.add(node)
  return { graph, node, widget, callback }
}

describe('applyLiveWidgetValue', () => {
  beforeEach(() =>
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  )

  it('guards a missing graph and identifies the widget in its warning', () => {
    expect(
      applyLiveWidgetValue(undefined, rootScope, toNodeId(7), 'value', 'after')
    ).toBe(false)
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('node 7, widget value: graph is not ready')
    )
  })

  it('guards a missing node or widget', () => {
    const graph = new LGraph()
    graph.id = 'root'
    expect(
      applyLiveWidgetValue(graph, rootScope, toNodeId(7), 'value', 'after')
    ).toBe(false)

    const node = new LGraphNode('Test')
    node.id = toNodeId(7)
    graph.add(node)
    expect(
      applyLiveWidgetValue(graph, rootScope, toNodeId(7), 'value', 'after')
    ).toBe(false)
  })

  it('updates both the widget value and callbacks with the previous value', () => {
    const { graph, node, widget, callback } = graphWithWidget()
    node.onWidgetChanged = vi.fn()

    expect(
      applyLiveWidgetValue(graph, rootScope, toNodeId(7), 'value', 'after')
    ).toBe(true)
    expect(widget.value).toBe('after')
    expect(callback).toHaveBeenCalledWith('after')
    expect(node.onWidgetChanged).toHaveBeenCalledWith(
      'value',
      'after',
      'before',
      widget
    )
  })

  it('skips callback-only and non-scalar widgets', () => {
    const { graph, widget, callback } = graphWithWidget('button')

    expect(
      applyLiveWidgetValue(graph, rootScope, toNodeId(7), 'value', 'after')
    ).toBe(false)
    expect(widget.value).toBe('before')
    expect(callback).not.toHaveBeenCalled()
  })

  it('resolves nodes from the owning subgraph instead of the root graph', () => {
    const graph = new LGraph()
    graph.id = 'root'
    const rootNode = new LGraphNode('Root')
    rootNode.id = toNodeId(8)
    const rootWidget = rootNode.addWidget(
      'text',
      'value',
      'root',
      () => undefined
    )
    graph.add(rootNode)

    const subgraph = createTestSubgraph({ rootGraph: graph })
    graph.subgraphs.set(subgraph.id, subgraph)
    const innerNode = new LGraphNode('Inner')
    innerNode.id = toNodeId(7)
    const innerWidget = innerNode.addWidget(
      'text',
      'value',
      'inner',
      () => undefined
    )
    subgraph.add(innerNode)

    expect(
      applyLiveWidgetValue(
        graph,
        {
          rootGraphId: toRootGraphId('root'),
          owningGraphId: toOwningGraphId(subgraph.id)
        },
        toNodeId(7),
        'value',
        'after'
      )
    ).toBe(true)
    expect(innerWidget.value).toBe('after')
    expect(rootWidget.value).toBe('root')
  })
})
