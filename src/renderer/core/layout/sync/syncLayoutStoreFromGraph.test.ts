import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'

import { syncLayoutStoreNodeBoundsFromGraph } from './syncLayoutStoreFromGraph'

function createGraph(nodes: LGraphNode[]): LGraph {
  return {
    nodes
  } as LGraph
}

function createNode(
  id: number,
  pos: [number, number],
  size: [number, number]
): LGraphNode {
  return {
    id,
    pos,
    size
  } as LGraphNode
}

describe('syncLayoutStoreNodeBoundsFromGraph', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    LiteGraph.vueNodesMode = false
  })

  it('syncs node bounds to layout store when Vue nodes mode is enabled', () => {
    LiteGraph.vueNodesMode = true

    const batchUpdateNodeBounds = vi
      .spyOn(layoutStore, 'batchUpdateNodeBounds')
      .mockImplementation(() => {})

    const graph = createGraph([
      createNode(1, [100, 200], [320, 140]),
      createNode(2, [450, 300], [225, 96])
    ])

    syncLayoutStoreNodeBoundsFromGraph(graph)

    expect(batchUpdateNodeBounds).toHaveBeenCalledWith([
      {
        nodeId: '1',
        bounds: {
          x: 100,
          y: 200,
          width: 320,
          height: 140
        }
      },
      {
        nodeId: '2',
        bounds: {
          x: 450,
          y: 300,
          width: 225,
          height: 96
        }
      }
    ])
  })

  it('does nothing when Vue nodes mode is disabled', () => {
    const batchUpdateNodeBounds = vi
      .spyOn(layoutStore, 'batchUpdateNodeBounds')
      .mockImplementation(() => {})

    const graph = createGraph([createNode(1, [100, 200], [320, 140])])

    syncLayoutStoreNodeBoundsFromGraph(graph)

    expect(batchUpdateNodeBounds).not.toHaveBeenCalled()
  })

  it('does nothing when graph has no nodes', () => {
    LiteGraph.vueNodesMode = true

    const batchUpdateNodeBounds = vi
      .spyOn(layoutStore, 'batchUpdateNodeBounds')
      .mockImplementation(() => {})

    const graph = createGraph([])

    syncLayoutStoreNodeBoundsFromGraph(graph)

    expect(batchUpdateNodeBounds).not.toHaveBeenCalled()
  })
})
