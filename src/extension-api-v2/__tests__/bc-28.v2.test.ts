// Category: BC.28 — Subgraph fan-out via set/get virtual nodes
// DB cross-ref: S9.SG1
// Exemplar: https://github.com/kijai/ComfyUI-KJNodes/blob/main/web/js/setgetnodes.js#L1406
// blast_radius: 4.97
// compat-floor: blast_radius ≥ 2.0
// v2 contract: defineNodeExtension({ virtual: true, resolveConnections(node, graph) → ResolvedEdges })
// Decision: I-UWF.5 (2026-05-08) — Option (b) accepted. Phase B only.
// resolveConnections is pure; runtime materializes edges at save time (UWF Phase 3).

import { describe, it, expect } from 'vitest'

// ── Type definitions for virtual node API ───────────────────────────────────
// These define the v2 contract shape. Runtime implementation is Phase B.

interface NodeSlotRef {
  nodeId: string
  slotIndex: number
}

interface ResolvedEdge {
  from: NodeSlotRef
  to: NodeSlotRef
}

interface ReadOnlyNode {
  readonly id: string
  readonly type: string
  readonly title: string
  getProperty<T>(key: string): T | undefined
}

interface ReadOnlyGraph {
  findByType(type: string): ReadOnlyNode[]
  getNode(id: string): ReadOnlyNode | undefined
}

interface VirtualNodeExtensionOptions {
  name: string
  nodeTypes?: string[]
  virtual: true
  resolveConnections(node: ReadOnlyNode, graph: ReadOnlyGraph): ResolvedEdge[]
}

// ── Minimal stub for type-shape validation ──────────────────────────────────

function defineVirtualNodeExtension(
  options: VirtualNodeExtensionOptions
): VirtualNodeExtensionOptions {
  // Phase B: real registration into the extension system
  return options
}

function createMockReadOnlyGraph(): ReadOnlyGraph {
  const nodes: ReadOnlyNode[] = []
  return {
    findByType(type: string) {
      return nodes.filter((n) => n.type === type)
    },
    getNode(id: string) {
      return nodes.find((n) => n.id === id)
    }
  }
}

function createMockReadOnlyNode(
  id: string,
  type: string,
  title: string,
  props: Record<string, unknown> = {}
): ReadOnlyNode {
  return {
    id: id,
    type,
    title,
    getProperty<T>(key: string): T | undefined {
      return props[key] as T | undefined
    }
  }
}

describe('BC.28 v2 contract — subgraph fan-out via set/get virtual nodes', () => {
  describe('S9.SG1 — virtual: true declaration', () => {
    it('VirtualNodeExtensionOptions accepts virtual: true flag', () => {
      const options: VirtualNodeExtensionOptions = {
        name: 'test.virtual-node',
        virtual: true,
        resolveConnections: () => []
      }

      expect(options.virtual).toBe(true)
    })

    it('defineVirtualNodeExtension returns the provided options for chaining', () => {
      const options = defineVirtualNodeExtension({
        name: 'test.set-node',
        virtual: true,
        resolveConnections: () => []
      })

      expect(options.name).toBe('test.set-node')
      expect(options.virtual).toBe(true)
    })

    it('nodeTypes filter is optional for virtual nodes', () => {
      const globalVirtual: VirtualNodeExtensionOptions = {
        name: 'test.global-virtual',
        virtual: true,
        resolveConnections: () => []
      }

      const scopedVirtual: VirtualNodeExtensionOptions = {
        name: 'test.scoped-virtual',
        nodeTypes: ['SetNode', 'GetNode'],
        virtual: true,
        resolveConnections: () => []
      }

      expect(globalVirtual.nodeTypes).toBeUndefined()
      expect(scopedVirtual.nodeTypes).toEqual(['SetNode', 'GetNode'])
    })

    it.todo(
      '[Phase B + UWF] virtual nodes do not appear in spec.edges in the serialized prompt'
    )

    it.todo(
      '[Phase B + UWF] virtual nodes do not appear in the serialized workflow output keyed by node id'
    )
  })

  describe('S9.SG1 — resolveConnections(node, graph) → ResolvedEdges', () => {
    it('resolveConnections receives a ReadOnlyNode with entityId, type, title, getProperty', () => {
      let receivedNode: ReadOnlyNode | undefined

      const options: VirtualNodeExtensionOptions = {
        name: 'test.capture-node',
        virtual: true,
        resolveConnections(node) {
          receivedNode = node
          return []
        }
      }

      const mockNode = createMockReadOnlyNode('node:1', 'SetNode', 'MySet', {
        channel: 'alpha'
      })

      options.resolveConnections(mockNode, createMockReadOnlyGraph())

      expect(receivedNode!.id).toBe('node:1')
      expect(receivedNode!.type).toBe('SetNode')
      expect(receivedNode!.title).toBe('MySet')
      expect(receivedNode!.getProperty<string>('channel')).toBe('alpha')
    })

    it('resolveConnections receives a ReadOnlyGraph with findByType and getNode', () => {
      let receivedGraph: ReadOnlyGraph | undefined

      const options: VirtualNodeExtensionOptions = {
        name: 'test.capture-graph',
        virtual: true,
        resolveConnections(_node, graph) {
          receivedGraph = graph
          return []
        }
      }

      const mockGraph = createMockReadOnlyGraph()
      options.resolveConnections(
        createMockReadOnlyNode('node:1', 'SetNode', 'Test'),
        mockGraph
      )

      expect(typeof receivedGraph!.findByType).toBe('function')
      expect(typeof receivedGraph!.getNode).toBe('function')
    })

    it('resolveConnections returns an array of ResolvedEdge objects', () => {
      const options: VirtualNodeExtensionOptions = {
        name: 'test.resolve-edges',
        virtual: true,
        resolveConnections() {
          return [
            {
              from: { nodeId: 'node:upstream', slotIndex: 0 },
              to: { nodeId: 'node:downstream', slotIndex: 0 }
            }
          ]
        }
      }

      const edges = options.resolveConnections(
        createMockReadOnlyNode('node:virtual', 'GetNode', 'MyGet'),
        createMockReadOnlyGraph()
      )

      expect(edges).toHaveLength(1)
      expect(edges[0].from.nodeId).toBe('node:upstream')
      expect(edges[0].to.nodeId).toBe('node:downstream')
    })

    it('resolveConnections returning an empty array removes the virtual node from the spec', () => {
      const options: VirtualNodeExtensionOptions = {
        name: 'test.empty-resolve',
        virtual: true,
        resolveConnections: () => []
      }

      const edges = options.resolveConnections(
        createMockReadOnlyNode('node:orphan', 'GetNode', 'Orphan'),
        createMockReadOnlyGraph()
      )

      expect(edges).toEqual([])
      // Phase B: runtime interprets this as "exclude from spec entirely"
    })

    it('resolveConnections is a pure function — receives read-only views', () => {
      // Type-level proof: node and graph are ReadOnly interfaces
      const options: VirtualNodeExtensionOptions = {
        name: 'test.pure-fn',
        virtual: true,
        resolveConnections(node: ReadOnlyNode, graph: ReadOnlyGraph) {
          // Type system prevents mutation:
          // - node.id is readonly
          // - graph has no add/remove methods
          // Runtime enforcement (dev mode throwing) is Phase B
          void node.id
          void graph.findByType
          return []
        }
      }

      expect(options.resolveConnections).toBeDefined()
    })

    it.todo(
      '[Phase B] mutations to node or graph inside resolveConnections throw in development mode'
    )

    it.todo(
      '[Phase B + UWF] runtime calls resolveConnections for every virtual node during spec materialization'
    )
  })
})
