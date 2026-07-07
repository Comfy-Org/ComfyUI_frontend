import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import type { ComputedRef } from 'vue'

import type { INodeOutputSlot } from '@/lib/litegraph/src/interfaces'
import type { LGraph, LGraphNode, LLink } from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import type {
  NodeId as LayoutNodeId,
  NodeLayout
} from '@/renderer/core/layout/types'
import { useLinkStore } from '@/stores/linkStore'
import { toLinkId } from '@/types/linkId'
import { toNodeId as layoutNodeId } from '@/types/nodeId'
import type { UUID } from '@/utils/uuid'
import { MinimapDataSourceFactory } from '@/renderer/extensions/minimap/data/MinimapDataSourceFactory'

// Mock layoutStore
vi.mock('@/renderer/core/layout/store/layoutStore', () => ({
  layoutStore: {
    getAllNodes: vi.fn()
  }
}))

// Mock useExecutionStore
vi.mock('@/stores/executionStore', () => ({
  useExecutionStore: vi.fn().mockReturnValue({
    nodeProgressStates: {}
  })
}))

const GRAPH_ID: UUID = 'minimap-graph'

// Helper to create mock links that satisfy LGraph['links'] type
function createMockLinks(): LGraph['links'] {
  const map = new Map<number, LLink>()
  return Object.assign(map, {}) as LGraph['links']
}

function createMockGraph(nodes: LGraphNode[] = []): LGraph {
  const graph = {
    _nodes: nodes,
    _groups: [],
    links: createMockLinks(),
    rootGraph: { id: GRAPH_ID }
  }
  return graph as unknown as LGraph
}

function mockEmptyLayoutStore() {
  const emptyMap = new Map<LayoutNodeId, NodeLayout>()
  const computedEmpty: ComputedRef<ReadonlyMap<LayoutNodeId, NodeLayout>> =
    computed(() => emptyMap)
  vi.mocked(layoutStore.getAllNodes).mockReturnValue(computedEmpty)
}

describe('MinimapDataSource', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  describe('MinimapDataSourceFactory', () => {
    it('should create LayoutStoreDataSource when LayoutStore has data', () => {
      // Arrange
      const mockNodes = new Map<LayoutNodeId, NodeLayout>([
        [
          layoutNodeId('node1'),
          {
            id: layoutNodeId('node1'),
            position: { x: 0, y: 0 },
            size: { width: 100, height: 50 },
            zIndex: 0,
            visible: true,
            bounds: { x: 0, y: 0, width: 100, height: 50 }
          }
        ]
      ])

      // Create a computed ref that returns the map
      const computedNodes: ComputedRef<ReadonlyMap<LayoutNodeId, NodeLayout>> =
        computed(() => mockNodes)
      vi.mocked(layoutStore.getAllNodes).mockReturnValue(computedNodes)

      // Act
      const dataSource = MinimapDataSourceFactory.create(createMockGraph())

      // Assert
      expect(dataSource).toBeDefined()
      expect(dataSource.hasData()).toBe(true)
      expect(dataSource.getNodeCount()).toBe(1)
    })

    it('should create LiteGraphDataSource when LayoutStore is empty', () => {
      // Arrange
      mockEmptyLayoutStore()

      const mockNode: Pick<
        LGraphNode,
        'id' | 'pos' | 'size' | 'bgcolor' | 'mode' | 'has_errors' | 'outputs'
      > = {
        id: layoutNodeId('node1'),
        pos: [0, 0],
        size: [100, 50],
        bgcolor: '#fff',
        mode: 0,
        has_errors: false,
        outputs: []
      }

      // Act
      const dataSource = MinimapDataSourceFactory.create(
        createMockGraph([mockNode as LGraphNode])
      )

      // Assert
      expect(dataSource).toBeDefined()
      expect(dataSource.hasData()).toBe(true)
      expect(dataSource.getNodeCount()).toBe(1)

      const nodes = dataSource.getNodes()
      expect(nodes).toHaveLength(1)
      expect(nodes[0]).toMatchObject({
        id: layoutNodeId('node1'),
        x: 0,
        y: 0,
        width: 100,
        height: 50
      })
    })

    it('should handle empty graph correctly', () => {
      // Arrange
      mockEmptyLayoutStore()

      // Act
      const dataSource = MinimapDataSourceFactory.create(createMockGraph())

      // Assert
      expect(dataSource.hasData()).toBe(false)
      expect(dataSource.getNodeCount()).toBe(0)
      expect(dataSource.getNodes()).toEqual([])
      expect(dataSource.getLinks()).toEqual([])
      expect(dataSource.getGroups()).toEqual([])
    })
  })

  describe('Link extraction', () => {
    function createLinkableNode(id: string, outputCount: number): LGraphNode {
      const node: Pick<LGraphNode, 'id' | 'pos' | 'size' | 'outputs'> = {
        id: layoutNodeId(id),
        pos: [0, 0],
        size: [100, 50],
        outputs: Array.from(
          { length: outputCount },
          () => ({}) as INodeOutputSlot
        )
      }
      return node as LGraphNode
    }

    it('derives links between visible nodes from the link store', () => {
      mockEmptyLayoutStore()
      useLinkStore().registerLink(GRAPH_ID, {
        id: toLinkId(1),
        originNodeId: layoutNodeId('node1'),
        originSlot: 0,
        targetNodeId: layoutNodeId('node2'),
        targetSlot: 1,
        type: 'INT'
      })

      const dataSource = MinimapDataSourceFactory.create(
        createMockGraph([
          createLinkableNode('node1', 1),
          createLinkableNode('node2', 0)
        ])
      )

      const links = dataSource.getLinks()
      expect(links).toHaveLength(1)
      expect(links[0]).toMatchObject({ sourceSlot: 0, targetSlot: 1 })
      expect(links[0].sourceNode.id).toBe(layoutNodeId('node1'))
      expect(links[0].targetNode.id).toBe(layoutNodeId('node2'))
    })

    it('omits links whose target is not in the viewed nodes', () => {
      mockEmptyLayoutStore()
      useLinkStore().registerLink(GRAPH_ID, {
        id: toLinkId(1),
        originNodeId: layoutNodeId('node1'),
        originSlot: 0,
        targetNodeId: layoutNodeId('elsewhere'),
        targetSlot: 0,
        type: 'INT'
      })

      const dataSource = MinimapDataSourceFactory.create(
        createMockGraph([createLinkableNode('node1', 1)])
      )

      expect(dataSource.getLinks()).toEqual([])
    })
  })

  describe('Bounds calculation', () => {
    it('should calculate correct bounds from nodes', () => {
      // Arrange
      mockEmptyLayoutStore()

      const mockNode1: Pick<LGraphNode, 'id' | 'pos' | 'size' | 'outputs'> = {
        id: layoutNodeId('node1'),
        pos: [0, 0],
        size: [100, 50],
        outputs: []
      }

      const mockNode2: Pick<LGraphNode, 'id' | 'pos' | 'size' | 'outputs'> = {
        id: layoutNodeId('node2'),
        pos: [200, 100],
        size: [150, 75],
        outputs: []
      }

      // Act
      const dataSource = MinimapDataSourceFactory.create(
        createMockGraph([mockNode1 as LGraphNode, mockNode2 as LGraphNode])
      )
      const bounds = dataSource.getBounds()

      // Assert
      expect(bounds).toEqual({
        minX: 0,
        minY: 0,
        maxX: 350,
        maxY: 175,
        width: 350,
        height: 175
      })
    })
  })
})
