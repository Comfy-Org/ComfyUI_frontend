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

  it('reads each node layout once while sorting', () => {
    const graph = new LGraph()
    const nodes = [addedNode(graph), addedNode(graph), addedNode(graph)]
    const getNodeLayout = vi.spyOn(layoutStore, 'getNodeLayout')

    nodesInRenderOrder(graph)

    expect(getNodeLayout).toHaveBeenCalledTimes(nodes.length)
  })
})
