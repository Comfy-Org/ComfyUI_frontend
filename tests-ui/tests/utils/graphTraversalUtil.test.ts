import type { LGraph, LGraphNode, Subgraph } from '@comfyorg/litegraph'
import { describe, expect, it, vi } from 'vitest'

import {
  collectAllNodes,
  findNodeInHierarchy,
  findSubgraphByUuid,
  getLocalNodeIdFromExecutionId,
  getNodeByExecutionId,
  getNodeByLocatorId,
  getSubgraphPathFromExecutionId,
  parseExecutionId,
  traverseSubgraphPath,
  triggerCallbackOnAllNodes,
  visitGraphNodes
} from '@/utils/graphTraversalUtil'

// Mock node factory
function createMockNode(
  id: string | number,
  options: {
    isSubgraph?: boolean
    subgraph?: Subgraph
    callback?: () => void
  } = {}
): LGraphNode {
  return {
    id,
    isSubgraphNode: options.isSubgraph ? () => true : undefined,
    subgraph: options.subgraph,
    onExecutionStart: options.callback
  } as unknown as LGraphNode
}

// Mock graph factory
function createMockGraph(nodes: LGraphNode[]): LGraph {
  return {
    _nodes: nodes,
    nodes: nodes,
    getNodeById: (id: string | number) =>
      nodes.find((n) => String(n.id) === String(id)) || null
  } as unknown as LGraph
}

// Mock subgraph factory
function createMockSubgraph(id: string, nodes: LGraphNode[]): Subgraph {
  return {
    id,
    _nodes: nodes,
    nodes: nodes,
    getNodeById: (nodeId: string | number) =>
      nodes.find((n) => String(n.id) === String(nodeId)) || null
  } as unknown as Subgraph
}

describe('graphTraversalUtil', () => {
  describe('Pure utility functions', () => {
    describe('parseExecutionId', () => {
      it('should parse simple execution ID', () => {
        expect(parseExecutionId('123')).toEqual(['123'])
      })

      it('should parse complex execution ID', () => {
        expect(parseExecutionId('123:456:789')).toEqual(['123', '456', '789'])
      })

      it('should handle empty parts', () => {
        expect(parseExecutionId('123::789')).toEqual(['123', '789'])
      })

      it('should return null for invalid input', () => {
        expect(parseExecutionId('')).toBeNull()
        expect(parseExecutionId(null as any)).toBeNull()
        expect(parseExecutionId(undefined as any)).toBeNull()
      })
    })

    describe('getLocalNodeIdFromExecutionId', () => {
      it('should extract local node ID from simple ID', () => {
        expect(getLocalNodeIdFromExecutionId('123')).toBe('123')
      })

      it('should extract local node ID from complex ID', () => {
        expect(getLocalNodeIdFromExecutionId('123:456:789')).toBe('789')
      })

      it('should return null for invalid input', () => {
        expect(getLocalNodeIdFromExecutionId('')).toBeNull()
      })
    })

    describe('getSubgraphPathFromExecutionId', () => {
      it('should return empty array for root node', () => {
        expect(getSubgraphPathFromExecutionId('123')).toEqual([])
      })

      it('should return subgraph path for nested node', () => {
        expect(getSubgraphPathFromExecutionId('123:456:789')).toEqual([
          '123',
          '456'
        ])
      })

      it('should return empty array for invalid input', () => {
        expect(getSubgraphPathFromExecutionId('')).toEqual([])
      })
    })

    describe('visitGraphNodes', () => {
      it('should visit all nodes in graph', () => {
        const visited: number[] = []
        const nodes = [createMockNode(1), createMockNode(2), createMockNode(3)]
        const graph = createMockGraph(nodes)

        visitGraphNodes(graph, (node) => {
          visited.push(node.id as number)
        })

        expect(visited).toEqual([1, 2, 3])
      })

      it('should handle empty graph', () => {
        const visited: number[] = []
        const graph = createMockGraph([])

        visitGraphNodes(graph, (node) => {
          visited.push(node.id as number)
        })

        expect(visited).toEqual([])
      })
    })

    describe('traverseSubgraphPath', () => {
      it('should return start graph for empty path', () => {
        const graph = createMockGraph([])
        const result = traverseSubgraphPath(graph, [])
        expect(result).toBe(graph)
      })

      it('should traverse single level', () => {
        const subgraph = createMockSubgraph('sub-uuid', [])
        const node = createMockNode('1', { isSubgraph: true, subgraph })
        const graph = createMockGraph([node])

        const result = traverseSubgraphPath(graph, ['1'])
        expect(result).toBe(subgraph)
      })

      it('should traverse multiple levels', () => {
        const deepSubgraph = createMockSubgraph('deep-uuid', [])
        const midNode = createMockNode('2', {
          isSubgraph: true,
          subgraph: deepSubgraph
        })
        const midSubgraph = createMockSubgraph('mid-uuid', [midNode])
        const topNode = createMockNode('1', {
          isSubgraph: true,
          subgraph: midSubgraph
        })
        const graph = createMockGraph([topNode])

        const result = traverseSubgraphPath(graph, ['1', '2'])
        expect(result).toBe(deepSubgraph)
      })

      it('should return null for invalid path', () => {
        const graph = createMockGraph([createMockNode('1')])
        const result = traverseSubgraphPath(graph, ['999'])
        expect(result).toBeNull()
      })
    })
  })

  describe('Main functions', () => {
    describe('triggerCallbackOnAllNodes', () => {
      it('should trigger callbacks on all nodes in a flat graph', () => {
        const callback1 = vi.fn()
        const callback2 = vi.fn()

        const node1 = createMockNode(1, { callback: callback1 })
        const node2 = createMockNode(2, { callback: callback2 })
        const node3 = createMockNode(3) // No callback

        const graph = createMockGraph([node1, node2, node3])

        triggerCallbackOnAllNodes(graph, 'onExecutionStart')

        expect(callback1).toHaveBeenCalledOnce()
        expect(callback2).toHaveBeenCalledOnce()
      })

      it('should trigger callbacks on nodes in subgraphs', () => {
        const callback1 = vi.fn()
        const callback2 = vi.fn()
        const callback3 = vi.fn()

        // Create a subgraph with one node
        const subNode = createMockNode(100, { callback: callback3 })
        const subgraph = createMockSubgraph('sub-uuid', [subNode])

        // Create main graph with two nodes, one being a subgraph
        const node1 = createMockNode(1, { callback: callback1 })
        const node2 = createMockNode(2, {
          isSubgraph: true,
          subgraph,
          callback: callback2
        })

        const graph = createMockGraph([node1, node2])

        triggerCallbackOnAllNodes(graph, 'onExecutionStart')

        expect(callback1).toHaveBeenCalledOnce()
        expect(callback2).toHaveBeenCalledOnce()
        expect(callback3).toHaveBeenCalledOnce()
      })

      it('should handle nested subgraphs', () => {
        const callbacks = [vi.fn(), vi.fn(), vi.fn(), vi.fn()]

        // Create deeply nested structure
        const deepNode = createMockNode(300, { callback: callbacks[3] })
        const deepSubgraph = createMockSubgraph('deep-uuid', [deepNode])

        const midNode1 = createMockNode(200, { callback: callbacks[2] })
        const midNode2 = createMockNode(201, {
          isSubgraph: true,
          subgraph: deepSubgraph
        })
        const midSubgraph = createMockSubgraph('mid-uuid', [midNode1, midNode2])

        const node1 = createMockNode(1, { callback: callbacks[0] })
        const node2 = createMockNode(2, {
          isSubgraph: true,
          subgraph: midSubgraph,
          callback: callbacks[1]
        })

        const graph = createMockGraph([node1, node2])

        triggerCallbackOnAllNodes(graph, 'onExecutionStart')

        callbacks.forEach((cb) => expect(cb).toHaveBeenCalledOnce())
      })
    })

    describe('collectAllNodes', () => {
      it('should collect all nodes from a flat graph', () => {
        const nodes = [createMockNode(1), createMockNode(2), createMockNode(3)]

        const graph = createMockGraph(nodes)
        const collected = collectAllNodes(graph)

        expect(collected).toHaveLength(3)
        expect(collected.map((n) => n.id)).toEqual([1, 2, 3])
      })

      it('should collect nodes from subgraphs', () => {
        const subNode = createMockNode(100)
        const subgraph = createMockSubgraph('sub-uuid', [subNode])

        const nodes = [
          createMockNode(1),
          createMockNode(2, { isSubgraph: true, subgraph })
        ]

        const graph = createMockGraph(nodes)
        const collected = collectAllNodes(graph)

        expect(collected).toHaveLength(3)
        expect(collected.map((n) => n.id)).toContain(100)
      })

      it('should filter nodes when filter function provided', () => {
        const nodes = [createMockNode(1), createMockNode(2), createMockNode(3)]

        const graph = createMockGraph(nodes)
        const collected = collectAllNodes(graph, (node) => Number(node.id) > 1)

        expect(collected).toHaveLength(2)
        expect(collected.map((n) => n.id)).toEqual([2, 3])
      })
    })

    describe('findNodeInHierarchy', () => {
      it('should find node in root graph', () => {
        const nodes = [createMockNode(1), createMockNode(2), createMockNode(3)]

        const graph = createMockGraph(nodes)
        const found = findNodeInHierarchy(graph, 2)

        expect(found).toBeTruthy()
        expect(found?.id).toBe(2)
      })

      it('should find node in subgraph', () => {
        const subNode = createMockNode(100)
        const subgraph = createMockSubgraph('sub-uuid', [subNode])

        const nodes = [
          createMockNode(1),
          createMockNode(2, { isSubgraph: true, subgraph })
        ]

        const graph = createMockGraph(nodes)
        const found = findNodeInHierarchy(graph, 100)

        expect(found).toBeTruthy()
        expect(found?.id).toBe(100)
      })

      it('should return null for non-existent node', () => {
        const nodes = [createMockNode(1), createMockNode(2)]
        const graph = createMockGraph(nodes)

        const found = findNodeInHierarchy(graph, 999)
        expect(found).toBeNull()
      })
    })

    describe('findSubgraphByUuid', () => {
      it('should find subgraph by UUID', () => {
        const targetUuid = 'target-uuid'
        const subgraph = createMockSubgraph(targetUuid, [])

        const nodes = [
          createMockNode(1),
          createMockNode(2, { isSubgraph: true, subgraph })
        ]

        const graph = createMockGraph(nodes)
        const found = findSubgraphByUuid(graph, targetUuid)

        expect(found).toBe(subgraph)
        expect(found?.id).toBe(targetUuid)
      })

      it('should find nested subgraph', () => {
        const targetUuid = 'deep-uuid'
        const deepSubgraph = createMockSubgraph(targetUuid, [])

        const midSubgraph = createMockSubgraph('mid-uuid', [
          createMockNode(200, { isSubgraph: true, subgraph: deepSubgraph })
        ])

        const graph = createMockGraph([
          createMockNode(1, { isSubgraph: true, subgraph: midSubgraph })
        ])

        const found = findSubgraphByUuid(graph, targetUuid)

        expect(found).toBe(deepSubgraph)
        expect(found?.id).toBe(targetUuid)
      })

      it('should return null for non-existent UUID', () => {
        const subgraph = createMockSubgraph('some-uuid', [])
        const graph = createMockGraph([
          createMockNode(1, { isSubgraph: true, subgraph })
        ])

        const found = findSubgraphByUuid(graph, 'non-existent-uuid')
        expect(found).toBeNull()
      })
    })

    describe('getNodeByExecutionId', () => {
      it('should find node in root graph', () => {
        const nodes = [createMockNode('123'), createMockNode('456')]

        const graph = createMockGraph(nodes)
        const found = getNodeByExecutionId(graph, '123')

        expect(found).toBeTruthy()
        expect(found?.id).toBe('123')
      })

      it('should find node in subgraph using execution path', () => {
        const targetNode = createMockNode('789')
        const subgraph = createMockSubgraph('sub-uuid', [targetNode])

        const subgraphNode = createMockNode('456', {
          isSubgraph: true,
          subgraph
        })

        const graph = createMockGraph([createMockNode('123'), subgraphNode])

        const found = getNodeByExecutionId(graph, '456:789')

        expect(found).toBe(targetNode)
        expect(found?.id).toBe('789')
      })

      it('should handle deeply nested execution paths', () => {
        const targetNode = createMockNode('999')
        const deepSubgraph = createMockSubgraph('deep-uuid', [targetNode])

        const midNode = createMockNode('456', {
          isSubgraph: true,
          subgraph: deepSubgraph
        })
        const midSubgraph = createMockSubgraph('mid-uuid', [midNode])

        const topNode = createMockNode('123', {
          isSubgraph: true,
          subgraph: midSubgraph
        })

        const graph = createMockGraph([topNode])

        const found = getNodeByExecutionId(graph, '123:456:999')

        expect(found).toBe(targetNode)
        expect(found?.id).toBe('999')
      })

      it('should return null for invalid path', () => {
        const subgraph = createMockSubgraph('sub-uuid', [createMockNode('789')])
        const graph = createMockGraph([
          createMockNode('456', { isSubgraph: true, subgraph })
        ])

        // Wrong path - node 123 doesn't exist
        const found = getNodeByExecutionId(graph, '123:789')
        expect(found).toBeNull()
      })

      it('should return null for invalid execution ID', () => {
        const graph = createMockGraph([createMockNode('123')])
        const found = getNodeByExecutionId(graph, '')
        expect(found).toBeNull()
      })
    })

    describe('getNodeByLocatorId', () => {
      it('should find node in root graph', () => {
        const nodes = [createMockNode('123'), createMockNode('456')]

        const graph = createMockGraph(nodes)
        const found = getNodeByLocatorId(graph, '123')

        expect(found).toBeTruthy()
        expect(found?.id).toBe('123')
      })

      it('should find node in subgraph using UUID format', () => {
        const targetUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
        const targetNode = createMockNode('789')
        const subgraph = createMockSubgraph(targetUuid, [targetNode])

        const graph = createMockGraph([
          createMockNode('123'),
          createMockNode('456', { isSubgraph: true, subgraph })
        ])

        const locatorId = `${targetUuid}:789`
        const found = getNodeByLocatorId(graph, locatorId)

        expect(found).toBe(targetNode)
        expect(found?.id).toBe('789')
      })

      it('should return null for invalid locator ID', () => {
        const graph = createMockGraph([createMockNode('123')])

        const found = getNodeByLocatorId(graph, 'invalid:::format')
        expect(found).toBeNull()
      })

      it('should return null when subgraph UUID not found', () => {
        const subgraph = createMockSubgraph('some-uuid', [
          createMockNode('789')
        ])
        const graph = createMockGraph([
          createMockNode('456', { isSubgraph: true, subgraph })
        ])

        const locatorId = 'non-existent-uuid:789'
        const found = getNodeByLocatorId(graph, locatorId)
        expect(found).toBeNull()
      })
    })
  })
})
