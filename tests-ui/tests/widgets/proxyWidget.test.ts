import { describe, expect, test, vi } from 'vitest'

//import { ComponentWidgetImpl, DOMWidgetImpl } from '@/scripts/domWidget'

import { LGraphNode, type SubgraphNode } from '@/lib/litegraph/src/litegraph'
import '@/scripts/proxyWidget'

import {
  createTestSubgraph,
  createTestSubgraphNode
} from '../litegraph/subgraph/fixtures/subgraphHelpers'

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({})
}))
vi.mock('@/stores/domWidgetStore', () => ({
  useDomWidgetStore: () => ({ widgetStates: new Map() })
}))

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
    expect(subgraphNode.properties.proxyWidgets).toBe(
      JSON.stringify([['1', 'stringWidget']])
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
    expect(subgraphNode.widgets[0].value).toBe('value')
    innerNodes[0].widgets![0].value = 'test'
    expect(subgraphNode.widgets[0].value).toBe('test')
    subgraphNode.widgets[0].value = 'test2'
    expect(innerNodes[0].widgets![0].value).toBe('test2')
  })
  test('Will not modify position or sizing of existing widgets', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'stringWidget', 'value', () => {})
    subgraphNode.properties.proxyWidgets = JSON.stringify([
      ['1', 'stringWidget']
    ])
    if (!innerNodes[0].widgets) throw new Error('node has no widgets')
    innerNodes[0].widgets[0].y = 10
    innerNodes[0].widgets[0].last_y = 11
    innerNodes[0].widgets[0].computedHeight = 12
    subgraphNode.widgets[0].y = 20
    subgraphNode.widgets[0].last_y = 21
    subgraphNode.widgets[0].computedHeight = 22
    expect(innerNodes[0].widgets[0].y).toBe(10)
    expect(innerNodes[0].widgets[0].last_y).toBe(11)
    expect(innerNodes[0].widgets[0].computedHeight).toBe(12)
  })
  test('Can detatch and re-attach widgets', () => {
    const [subgraphNode, innerNodes] = setupSubgraph(1)
    innerNodes[0].addWidget('text', 'stringWidget', 'value', () => {})
    subgraphNode.properties.proxyWidgets = JSON.stringify([
      ['1', 'stringWidget']
    ])
    if (!innerNodes[0].widgets) throw new Error('node has no widgets')
    expect(subgraphNode.widgets[0].value).toBe('value')
    const poppedWidget = innerNodes[0].widgets.pop()
    //simulate new draw frame
    subgraphNode.widgets[0].computedHeight = 10
    expect(subgraphNode.widgets[0].value).toBe(undefined)
    innerNodes[0].widgets.push(poppedWidget!)
    subgraphNode.widgets[0].computedHeight = 10
    expect(subgraphNode.widgets[0].value).toBe('value')
  })
})
