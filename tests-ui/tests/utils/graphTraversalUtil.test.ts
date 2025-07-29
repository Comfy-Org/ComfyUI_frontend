import type { LGraph, LGraphNode, Subgraph } from '@comfyorg/litegraph'
import { describe, expect, it, vi } from 'vitest'

import {
  collectAllNodes,
  findNodeInHierarchy,
  findSubgraphByUuid,
  forEachNode,
  forEachSubgraphNode,
  getLocalNodeIdFromExecutionId,
  getNodeByExecutionId,
  getNodeByLocatorId,
  getRootGraph,
  getSubgraphPathFromExecutionId,
  mapAllNodes,
  mapSubgraphNodes,
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

    describe('mapAllNodes', () => {
      it('should map over all nodes in a flat graph', () => {
        const nodes = [createMockNode(1), createMockNode(2), createMockNode(3)]
        const graph = createMockGraph(nodes)

        const results = mapAllNodes(graph, (node) => node.id)

        expect(results).toEqual([1, 2, 3])
      })

      it('should map over nodes in subgraphs', () => {
        const subNode = createMockNode(100)
        const subgraph = createMockSubgraph('sub-uuid', [subNode])

        const nodes = [
          createMockNode(1),
          createMockNode(2, { isSubgraph: true, subgraph })
        ]

        const graph = createMockGraph(nodes)
        const results = mapAllNodes(graph, (node) => node.id)

        expect(results).toHaveLength(3)
        expect(results).toContain(100)
      })

      it('should exclude undefined results', () => {
        const nodes = [createMockNode(1), createMockNode(2), createMockNode(3)]
        const graph = createMockGraph(nodes)

        const results = mapAllNodes(graph, (node) => {
          return Number(node.id) > 1 ? node.id : undefined
        })

        expect(results).toEqual([2, 3])
      })

      it('should handle deeply nested structures', () => {
        const deepNode = createMockNode(300)
        const deepSubgraph = createMockSubgraph('deep-uuid', [deepNode])

        const midNode = createMockNode(200)
        const midSubgraphNode = createMockNode(201, {
          isSubgraph: true,
          subgraph: deepSubgraph
        })
        const midSubgraph = createMockSubgraph('mid-uuid', [
          midNode,
          midSubgraphNode
        ])

        const nodes = [
          createMockNode(1),
          createMockNode(2, { isSubgraph: true, subgraph: midSubgraph })
        ]

        const graph = createMockGraph(nodes)
        const results = mapAllNodes(graph, (node) => `node-${node.id}`)

        expect(results).toHaveLength(5)
        expect(results).toContain('node-300')
      })
    })

    describe('forEachNode', () => {
      it('should execute function on all nodes in a flat graph', () => {
        const nodes = [createMockNode(1), createMockNode(2), createMockNode(3)]
        const graph = createMockGraph(nodes)

        const visited: number[] = []
        forEachNode(graph, (node) => {
          visited.push(node.id as number)
        })

        expect(visited).toHaveLength(3)
        expect(visited).toContain(1)
        expect(visited).toContain(2)
        expect(visited).toContain(3)
      })

      it('should execute function on nodes in subgraphs', () => {
        const subNode = createMockNode(100)
        const subgraph = createMockSubgraph('sub-uuid', [subNode])

        const nodes = [
          createMockNode(1),
          createMockNode(2, { isSubgraph: true, subgraph })
        ]

        const graph = createMockGraph(nodes)

        const visited: number[] = []
        forEachNode(graph, (node) => {
          visited.push(node.id as number)
        })

        expect(visited).toHaveLength(3)
        expect(visited).toContain(100)
      })

      it('should allow node mutations', () => {
        const nodes = [createMockNode(1), createMockNode(2), createMockNode(3)]
        const graph = createMockGraph(nodes)

        // Add a title property to each node
        forEachNode(graph, (node) => {
          ;(node as any).title = `Node ${node.id}`
        })

        expect(nodes[0]).toHaveProperty('title', 'Node 1')
        expect(nodes[1]).toHaveProperty('title', 'Node 2')
        expect(nodes[2]).toHaveProperty('title', 'Node 3')
      })

      it('should handle node type matching for subgraph references', () => {
        const subgraphId = 'my-subgraph-123'
        const nodes = [
          createMockNode(1),
          { ...createMockNode(2), type: subgraphId } as LGraphNode,
          createMockNode(3),
          { ...createMockNode(4), type: subgraphId } as LGraphNode
        ]
        const graph = createMockGraph(nodes)

        const matchingNodes: number[] = []
        forEachNode(graph, (node) => {
          if (node.type === subgraphId) {
            matchingNodes.push(node.id as number)
          }
        })

        expect(matchingNodes).toEqual([2, 4])
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

    describe('getRootGraph', () => {
      it('should return the same graph if it is already root', () => {
        const graph = createMockGraph([])
        expect(getRootGraph(graph)).toBe(graph)
      })

      it('should return root graph from subgraph', () => {
        const rootGraph = createMockGraph([])
        const subgraph = createMockSubgraph('sub-uuid', [])
        ;(subgraph as any).rootGraph = rootGraph

        expect(getRootGraph(subgraph)).toBe(rootGraph)
      })

      it('should return root graph from deeply nested subgraph', () => {
        const rootGraph = createMockGraph([])
        const midSubgraph = createMockSubgraph('mid-uuid', [])
        const deepSubgraph = createMockSubgraph('deep-uuid', [])

        ;(midSubgraph as any).rootGraph = rootGraph
        ;(deepSubgraph as any).rootGraph = midSubgraph

        expect(getRootGraph(deepSubgraph)).toBe(rootGraph)
      })
    })

    describe('forEachSubgraphNode', () => {
      it('should apply function to all nodes matching subgraph type', () => {
        const subgraphId = 'my-subgraph-123'
        const nodes = [
          createMockNode(1),
          { ...createMockNode(2), type: subgraphId } as LGraphNode,
          createMockNode(3),
          { ...createMockNode(4), type: subgraphId } as LGraphNode
        ]
        const graph = createMockGraph(nodes)

        const matchingIds: number[] = []
        forEachSubgraphNode(graph, subgraphId, (node) => {
          matchingIds.push(node.id as number)
        })

        expect(matchingIds).toEqual([2, 4])
      })

      it('should work with root graph directly', () => {
        const subgraphId = 'target-subgraph'
        const rootNodes = [
          { ...createMockNode(1), type: subgraphId } as LGraphNode,
          createMockNode(2),
          { ...createMockNode(3), type: subgraphId } as LGraphNode
        ]
        const rootGraph = createMockGraph(rootNodes)

        const matchingIds: number[] = []
        forEachSubgraphNode(rootGraph, subgraphId, (node) => {
          matchingIds.push(node.id as number)
        })

        expect(matchingIds).toEqual([1, 3])
      })

      it('should handle null inputs gracefully', () => {
        const fn = vi.fn()

        forEachSubgraphNode(null, 'id', fn)
        forEachSubgraphNode(createMockGraph([]), null, fn)
        forEachSubgraphNode(null, null, fn)

        expect(fn).not.toHaveBeenCalled()
      })

      it('should allow node mutations like title updates', () => {
        const subgraphId = 'my-subgraph'
        const nodes = [
          { ...createMockNode(1), type: subgraphId } as LGraphNode,
          { ...createMockNode(2), type: subgraphId } as LGraphNode,
          createMockNode(3)
        ]
        const graph = createMockGraph(nodes)

        forEachSubgraphNode(graph, subgraphId, (node) => {
          ;(node as any).title = 'Updated Title'
        })

        expect(nodes[0]).toHaveProperty('title', 'Updated Title')
        expect(nodes[1]).toHaveProperty('title', 'Updated Title')
        expect(nodes[2]).not.toHaveProperty('title', 'Updated Title')
      })
    })

    describe('mapSubgraphNodes', () => {
      it('should map over nodes matching subgraph type', () => {
        const subgraphId = 'my-subgraph-123'
        const nodes = [
          createMockNode(1),
          { ...createMockNode(2), type: subgraphId } as LGraphNode,
          createMockNode(3),
          { ...createMockNode(4), type: subgraphId } as LGraphNode
        ]
        const graph = createMockGraph(nodes)

        const results = mapSubgraphNodes(graph, subgraphId, (node) => node.id)

        expect(results).toEqual([2, 4])
      })

      it('should return empty array for null inputs', () => {
        expect(mapSubgraphNodes(null, 'id', (n) => n.id)).toEqual([])
        expect(
          mapSubgraphNodes(createMockGraph([]), null, (n) => n.id)
        ).toEqual([])
      })

      it('should work with complex transformations', () => {
        const subgraphId = 'target'
        const nodes = [
          { ...createMockNode(1), type: subgraphId } as LGraphNode,
          { ...createMockNode(2), type: 'other' } as LGraphNode,
          { ...createMockNode(3), type: subgraphId } as LGraphNode
        ]
        const graph = createMockGraph(nodes)

        const results = mapSubgraphNodes(graph, subgraphId, (node) => ({
          id: node.id,
          isTarget: true
        }))

        expect(results).toEqual([
          { id: 1, isTarget: true },
          { id: 3, isTarget: true }
        ])
      })
    })
  })
})
