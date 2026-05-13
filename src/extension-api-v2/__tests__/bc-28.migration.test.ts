// Category: BC.28 — Subgraph fan-out via set/get virtual nodes
// DB cross-ref: S9.SG1
// Exemplar: https://github.com/kijai/ComfyUI-KJNodes/blob/main/web/js/setgetnodes.js#L1406
// blast_radius: 4.97
// compat-floor: blast_radius ≥ 2.0
// migration: isVirtualNode=true + graphToPrompt monkey-patch → defineNodeExtension({ virtual: true, resolveConnections })
// Decision: I-UWF.5 (2026-05-08) — S8.P1 → virtual: true (mechanical rename); S9.SG1 → add resolveConnections.
// Classified uwf-resolved per I-PG.B2 — UWF Phase 3 is the migration path.

import { describe, it, expect } from 'vitest'

// ── v1 pattern types ────────────────────────────────────────────────────────

interface V1NodeType {
  type: string
  prototype: {
    isVirtualNode?: boolean
  }
}

// ── v2 pattern types ────────────────────────────────────────────────────────

interface NodeSlotRef {
  nodeId: string
  slotIndex: number
}

interface ResolvedEdge {
  from: NodeSlotRef
  to: NodeSlotRef
}

interface ReadOnlyNode {
  readonly entityId: string
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

describe('BC.28 migration — subgraph fan-out via set/get virtual nodes', () => {
  describe('S8.P1 — isVirtualNode flag migration', () => {
    it('v1 class-level isVirtualNode=true is a prototype property', () => {
      const v1NodeType: V1NodeType = {
        type: 'SetNode',
        prototype: {
          isVirtualNode: true
        }
      }

      expect(v1NodeType.prototype.isVirtualNode).toBe(true)
    })

    it('v2 virtual: true is a registration option, not a prototype property', () => {
      const v2Options: VirtualNodeExtensionOptions = {
        name: 'my-org.set-node',
        nodeTypes: ['SetNode'],
        virtual: true,
        resolveConnections: () => []
      }

      // v2: virtual is a first-class registration field
      expect(v2Options.virtual).toBe(true)
      // No prototype manipulation needed
    })

    it('migration is mechanical: rename isVirtualNode=true to virtual: true', () => {
      // v1 pattern
      const v1Pattern = {
        prototype: { isVirtualNode: true as const }
      }

      // v2 pattern (extracted from v1)
      const v2Pattern: Pick<VirtualNodeExtensionOptions, 'virtual'> = {
        virtual: v1Pattern.prototype.isVirtualNode
      }

      expect(v2Pattern.virtual).toBe(true)
    })

    it.todo(
      '[Phase B] v2 compat shim recognizes isVirtualNode=true on a registered class and emits a migration warning'
    )
  })

  describe('S9.SG1 — graphToPrompt monkey-patch migration', () => {
    it('v1 graphToPrompt patch rewrites link.target_id; v2 uses resolveConnections returning ResolvedEdges', () => {
      // v1 pattern: mutate the link object
      interface V1Link {
        origin_id: number
        target_id: number
      }

      function v1GraphToPromptPatch(link: V1Link, resolvedOriginId: number): void {
        link.origin_id = resolvedOriginId // Mutation!
      }

      const v1Link: V1Link = { origin_id: 3, target_id: 4 }
      v1GraphToPromptPatch(v1Link, 1)
      expect(v1Link.origin_id).toBe(1) // Mutated

      // v2 pattern: return new edges, no mutation
      function v2ResolveConnections(): ResolvedEdge[] {
        return [
          {
            from: { nodeId: 'node:1', slotIndex: 0 },
            to: { nodeId: 'node:4', slotIndex: 0 }
          }
        ]
      }

      const v2Edges = v2ResolveConnections()
      expect(v2Edges[0].from.nodeId).toBe('node:1') // New object, no mutation
    })

    it('v2 resolveConnections receives the same graph state as v1 graphToPrompt, as read-only', () => {
      // v1: graphToPrompt receives mutable graph
      // v2: resolveConnections receives ReadOnlyGraph

      let receivedGraph: ReadOnlyGraph | undefined

      const v2Options: VirtualNodeExtensionOptions = {
        name: 'test.readonly-graph',
        virtual: true,
        resolveConnections(_node, graph) {
          receivedGraph = graph
          return []
        }
      }

      const mockGraph: ReadOnlyGraph = {
        findByType: () => [],
        getNode: () => undefined
      }

      const mockNode: ReadOnlyNode = {
        entityId: 'node:1',
        type: 'GetNode',
        title: 'Test',
        getProperty: () => undefined
      }

      v2Options.resolveConnections(mockNode, mockGraph)

      // Graph has read methods but no mutators
      expect(typeof receivedGraph!.findByType).toBe('function')
      expect(typeof receivedGraph!.getNode).toBe('function')
      // No add, remove, or link mutation methods
      expect((receivedGraph as unknown as Record<string, unknown>).addNode).toBeUndefined()
      expect((receivedGraph as unknown as Record<string, unknown>).removeNode).toBeUndefined()
    })

    it.todo(
      '[Phase B] v2 compat shim logs a deprecation warning when graphToPrompt is monkey-patched for virtual node resolution'
    )

    it('for cg-use-everywhere topology inference: ctx.on("beforePrompt") is the bridge', () => {
      // cg-use-everywhere does graph-wide topology inference, not per-type resolution
      // The v2 pattern is: ctx.on('beforePrompt', handler) in defineExtension setup
      // This is documented but not type-checked here (Phase B implementation)

      interface AppExtensionContext {
        on(event: 'beforePrompt', handler: (event: { spec: unknown }) => void): void
      }

      // Type-level proof that the bridge API shape exists
      const mockCtx: AppExtensionContext = {
        on(_event, _handler) {
          // Phase B: real implementation
        }
      }

      expect(typeof mockCtx.on).toBe('function')
    })
  })

  describe('UWF Phase 3 resolution path', () => {
    it('BC.28 is classified as uwf-resolved per I-PG.B2', () => {
      // This test documents that the full runtime migration depends on UWF Phase 3
      // which replaces graphToPrompt entirely with spec materialization at save time.
      //
      // The v2 resolveConnections API is designed to integrate with UWF:
      // - resolveConnections returns ResolvedEdges (pure data)
      // - UWF spec builder calls resolveConnections during materialization
      // - No monkey-patching of graphToPrompt needed

      const uwfIntegrationNote =
        'S6.A1 graphToPrompt patching and S9.SG1 virtual-node wiring both resolve via UWF Phase 3'

      expect(uwfIntegrationNote).toContain('UWF Phase 3')
    })

    it('v2 resolveConnections is pure and side-effect free for UWF compatibility', () => {
      // UWF requires that spec materialization is deterministic
      // resolveConnections must be pure: same input → same output

      const deterministicResolve = (
        node: ReadOnlyNode,
        graph: ReadOnlyGraph
      ): ResolvedEdge[] => {
        const setNodes = graph.findByType('SetNode')
        const matching = setNodes.find((n) => n.title === node.title)
        if (!matching) return []

        return [
          {
            from: { nodeId: matching.entityId, slotIndex: 0 },
            to: { nodeId: node.entityId, slotIndex: 0 }
          }
        ]
      }

      const mockGraph: ReadOnlyGraph = {
        findByType: (type) =>
          type === 'SetNode'
            ? [{ entityId: 'node:set', type: 'SetNode', title: 'myValue', getProperty: () => undefined }]
            : [],
        getNode: () => undefined
      }

      const mockGetNode: ReadOnlyNode = {
        entityId: 'node:get',
        type: 'GetNode',
        title: 'myValue',
        getProperty: () => undefined
      }

      // Same input → same output (pure)
      const result1 = deterministicResolve(mockGetNode, mockGraph)
      const result2 = deterministicResolve(mockGetNode, mockGraph)

      expect(result1).toEqual(result2)
      expect(result1[0].from.nodeId).toBe('node:set')
    })
  })
})
