import { describe, expect, test, vi } from 'vitest'

//import { ComponentWidgetImpl, DOMWidgetImpl } from '@/scripts/domWidget'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets.ts'
import '@/scripts/proxyWidget'

import {
  createTestSubgraph,
  createTestSubgraphNode
} from '../litegraph/subgraph/fixtures/subgraphHelpers'

vi.mock('@/stores/graphStore', () => ({
  useCanvasStore: () => ({})
}))
vi.mock('@/stores/domWidgetStore', () => ({
  useDomWidgetStore: () => ({ widgetStates: new Map() })
}))

function testWidget(nodeId: string | number, widgetName: string): IBaseWidget {
  return {
    _overlay: { isProxyWidget: true, nodeId: `${nodeId}`, widgetName }
  } as unknown as IBaseWidget
}

describe('Subgraph proxyWidgets', () => {
  test('Can add simple widget', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)
    subgraphNode._internalConfigureAfterSlots()
    const graph = subgraphNode.graph
    graph.add(subgraphNode)
    const innerNode = new LGraphNode('test-node')
    subgraph.add(innerNode)
    innerNode.addWidget('text', 'stringWidget', 'value', () => {})
    subgraphNode.properties.proxyWidgets = JSON.stringify([
      ['1', 'stringWidget']
    ])
    expect(subgraphNode.widgets.length).toBe(1)
  })
  test('Can read existing widget', () => {
    const subgraph = createTestSubgraph()
    const subgraphNode = createTestSubgraphNode(subgraph)
    subgraphNode._internalConfigureAfterSlots()
    const graph = subgraphNode.graph
    graph.add(subgraphNode)
    subgraphNode.widgets = [testWidget(5, 'testWidget')]

    expect(subgraphNode.properties.proxyWidgets).toBe(
      JSON.stringify([['5', 'testWidget']])
    )
  })
})
