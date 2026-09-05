import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import {
  arrangeForLegacyRender,
  nodesInRenderOrder
} from '@/renderer/core/canvas/litegraph/arrangeForLegacyRender'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import { toNodeId } from '@/types/nodeId'

function addedNode(graph: LGraph, id?: number) {
  const node = new LGraphNode('widgets')
  if (id !== undefined) node.id = toNodeId(id)
  node.addInput('image', 'IMAGE')
  node.addWidget('number', 'seed', 0, () => {})
  graph.add(node)
  return node
}

describe('arrangeForLegacyRender', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  afterEach(() => {
    LiteGraph.vueNodesMode = false
  })

  it('arranges nodes after Vue rendering clears the legacy draw gate', () => {
    const graph = new LGraph()
    const node = addedNode(graph)

    LiteGraph.vueNodesMode = true
    node.arrange()

    expect(node._widgetSlotsDirty).toBe(false)

    LiteGraph.vueNodesMode = false
    expect(() => arrangeForLegacyRender(graph)).not.toThrow()
  })

  it('leaves collapsed nodes alone', () => {
    const graph = new LGraph()
    const node = addedNode(graph)
    node.flags.collapsed = true
    node._widgetSlotsDirty = true

    arrangeForLegacyRender(graph)

    expect(node._widgetSlotsDirty).toBe(true)
  })

  it('returns authoritative render order without changing graph membership', () => {
    const graph = new LGraph()
    const first = addedNode(graph, 10)
    const second = addedNode(graph, 2)
    const third = addedNode(graph, 1)
    const mutations = useLayoutMutations(LayoutSource.Canvas)
    mutations.setNodeZIndex(graph.id, first.id, 2)
    mutations.setNodeZIndex(graph.id, second.id, 1)
    mutations.setNodeZIndex(graph.id, third.id, 1)

    expect(nodesInRenderOrder(graph)).toEqual([third, second, first])
    expect(graph._nodes).toEqual([first, second, third])
  })

  it('uses authoritative render order for default node hit testing', () => {
    const graph = new LGraph()
    const first = addedNode(graph)
    const second = addedNode(graph)
    const mutations = useLayoutMutations(LayoutSource.Canvas)
    first.updateArea()
    second.updateArea()

    mutations.setNodeZIndex(graph.id, first.id, 2)
    mutations.setNodeZIndex(graph.id, second.id, 1)
    expect(graph.getNodeOnPos(20, 20)).toBe(first)

    mutations.setNodeZIndex(graph.id, second.id, 3)
    expect(graph.getNodeOnPos(20, 20)).toBe(second)
  })

  it('uses at most one layout read per node and caches the order', () => {
    const graph = new LGraph()
    const nodes = [addedNode(graph), addedNode(graph), addedNode(graph)]
    const getNodeLayout = vi.spyOn(layoutStore, 'getNodeLayout')

    nodesInRenderOrder(graph)
    nodesInRenderOrder(graph)

    expect(getNodeLayout.mock.calls.length).toBeLessThanOrEqual(nodes.length)
  })

  it('refreshes cached order when adopting a pre-existing layout', () => {
    const graph = new LGraph()
    const first = addedNode(graph, 1)
    const secondId = toNodeId(2)
    layoutStore.applyOperation({
      type: 'createNode',
      graphId: graph.id,
      nodeId: secondId,
      layout: {
        id: secondId,
        position: { x: 0, y: 0 },
        size: { width: 140, height: 80 },
        bounds: { x: 0, y: 0, width: 140, height: 80 },
        zIndex: layoutStore.allocateZIndex(),
        visible: true
      },
      timestamp: Date.now(),
      source: LayoutSource.Canvas
    })
    const layoutVersion = layoutStore.layoutVersion
    const graphVersion = graph._version
    expect(nodesInRenderOrder(graph)).toEqual([first])

    const second = addedNode(graph, 2)

    expect(layoutStore.layoutVersion).toBe(layoutVersion)
    expect(graph._version).toBeGreaterThan(graphVersion)
    expect(nodesInRenderOrder(graph)).toEqual([first, second])
  })
})
