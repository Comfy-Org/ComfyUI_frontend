import { describe, expect, it } from 'vitest'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { toNodeId } from '@/types/nodeId'

import { getNodesInViewport, rectsOverlap } from './useViewportVirtualization'

function createNodeData(id: number): VueNodeData {
  return {
    executing: false,
    id: toNodeId(id),
    mode: 0,
    selected: false,
    title: String(id),
    type: 'test'
  }
}

function createNode(id: number, x: number, y: number): LGraphNode {
  const node = new LGraphNode(String(id))
  node.id = toNodeId(id)
  node.pos = [x, y]
  node.size = [100, 80]
  node.updateArea()
  return node
}

describe('viewport virtualization geometry', () => {
  it('treats touching bounds as visible', () => {
    expect(rectsOverlap([0, 0, 100, 100], [100, 40, 20, 20])).toBe(true)
    expect(rectsOverlap([0, 0, 100, 100], [101, 40, 20, 20])).toBe(false)
  })

  it('returns intersecting nodes in graph order without overscan', () => {
    const nodes = [
      createNode(1, 1000, 1000),
      createNode(2, 40, 40),
      createNode(3, -500, -500),
      createNode(4, 10, 10)
    ]
    const nodesById = new Map(nodes.map((node) => [node.id, node]))
    const result = getNodesInViewport(
      [1, 2, 3, 4].map(createNodeData),
      [0, 0, 200, 200],
      (id) => nodesById.get(id)
    )

    expect(Array.from(result)).toEqual([toNodeId(2), toNodeId(4)])
  })
})
