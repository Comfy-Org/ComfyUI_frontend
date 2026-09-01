import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { LayoutSource } from '@/renderer/core/layout/types'

/**
 * https://github.com/Comfy-Org/ComfyUI_frontend/pull/15924#discussion_r3858723872
 *
 * `graph._nodes` is only ever reordered by insertion (`push`) and removal
 * (`splice`) — nothing keeps it in z-order. `getNodeOnPos` must resolve
 * z-order (via `nodesInRenderOrder`) rather than falling back to `_nodes`'
 * insertion order when no explicit `nodeList` is supplied.
 */
function overlappingNode(graph: LGraph) {
  const node = new LGraphNode('overlap')
  node.pos = [0, 0]
  node.size = [100, 100]
  graph.add(node)
  node.updateArea()
  return node
}

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
})

describe('LGraph.getNodeOnPos z-order resolution', () => {
  it('returns the front-most node by z-order, not the most recently added node', () => {
    const graph = new LGraph()
    const addedFirst = overlappingNode(graph)
    const addedSecond = overlappingNode(graph)
    const { setNodeOrder } = useLayoutMutations(LayoutSource.Canvas)

    // The most recently added node is `addedSecond`, but bring the
    // earlier-inserted node to front without touching `_nodes` order.
    setNodeOrder(graph, addedFirst.id, 'front')

    expect(graph._nodes).toEqual([addedFirst, addedSecond])
    expect(graph.getNodeOnPos(50, 50)).toBe(addedFirst)
  })

  it('sending the front node to back exposes the other node underneath', () => {
    const graph = new LGraph()
    const addedFirst = overlappingNode(graph)
    const addedSecond = overlappingNode(graph)
    const { setNodeOrder } = useLayoutMutations(LayoutSource.Canvas)

    // Insertion order alone would already put addedSecond on top; send it to
    // back explicitly so a pass fixture can't hide behind insertion order.
    setNodeOrder(graph, addedSecond.id, 'back')

    expect(graph._nodes).toEqual([addedFirst, addedSecond])
    expect(graph.getNodeOnPos(50, 50)).toBe(addedFirst)
  })
})
