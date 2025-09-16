import { describe, expect, test, vi } from 'vitest'

//import { ComponentWidgetImpl, DOMWidgetImpl } from '@/scripts/domWidget'

import { LGraphNode, type SubgraphNode } from '@/lib/litegraph/src/litegraph'
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
function setupSubgraph(
  innerNodeCount: number = 0
): [SubgraphNode, LGraphNode[]] {
  const subgraph = createTestSubgraph()
  const subgraphNode = createTestSubgraphNode(subgraph)
  subgraphNode._internalConfigureAfterSlots()
  const graph = subgraphNode.graph
  graph.add(subgraphNode)
  const innerNodes = []
  for (let i = 0; i < innerNodeCount; i++) {
    const innerNode = new LGraphNode(`InnerNode${i}`)
    subgraph.add(innerNode)
    innerNodes.push(innerNode)
  }
  return [subgraphNode, innerNodes]
}

describe('Subgraph proxyWidgets', () => {
  test('Can add simple widget', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'stringWidget', 'value', () => {})
    subgraphNode.properties.proxyWidgets = JSON.stringify([
      ['1', 'stringWidget']
    ])
    expect(subgraphNode.widgets.length).toBe(1)
  })
  test('Can read existing widget', () => {
    const [subgraphNode] = setupSubgraph()
    subgraphNode.widgets = [testWidget(5, 'testWidget')]
    expect(subgraphNode.properties.proxyWidgets).toBe(
      JSON.stringify([['5', 'testWidget']])
    )
  })
  test('Can add multiple widgets with same name', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(2)
    for (const innerNode of innerNodes)
      innerNode.addWidget('text', 'stringWidget', 'value', () => {})
    subgraphNode.properties.proxyWidgets = JSON.stringify([
      ['1', 'stringWidget'],
      ['2', 'stringWidget']
    ])
    expect(subgraphNode.widgets.length).toBe(2)
    expect(subgraphNode.widgets[0].name).not.toEqual(
      subgraphNode.widgets[1].name
    )
  })
  test('Will not modify existing widgets', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'stringWidget', 'value', () => {})
    subgraphNode.addWidget('text', 'stringWidget', 'value', () => {})
    subgraphNode.properties.proxyWidgets = JSON.stringify([
      ['1', 'stringWidget']
    ])
    expect(subgraphNode.widgets.length).toBe(2)
    subgraphNode.properties.proxyWidgets = JSON.stringify([])
    expect(subgraphNode.widgets.length).toBe(1)
  })
  test('Will mirror changes to value', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'stringWidget', 'value', () => {})
    subgraphNode.properties.proxyWidgets = JSON.stringify([
      ['1', 'stringWidget']
    ])
    expect(subgraphNode.widgets.length).toBe(1)
    expect(subgraphNode.widgets![0].value).toBe('value')
    innerNodes[0].widgets![0].value = 'test'
    expect(subgraphNode.widgets![0].value).toBe('test')
    subgraphNode.widgets[0].value = 'test2'
    expect(innerNodes[0].widgets![0].value).toBe('test2')
  })
})
