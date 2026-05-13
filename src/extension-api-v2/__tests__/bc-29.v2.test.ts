// Category: BC.29 — Graph enumeration, mutation, and cross-scope identity
// DB cross-ref: S11.G2, S14.ID1
// Exemplar: https://github.com/yolain/ComfyUI-Easy-Use/blob/main/web_version/v1/js/easy/easyExtraMenu.js#L439
// blast_radius: 5.13
// compat-floor: blast_radius ≥ 2.0
// v2 contract: comfyApp.graph.findByType, addNode, removeNode; NodeLocatorId helpers stable

import { describe, it, expect } from 'vitest'
import {
  isNodeLocatorId,
  isNodeExecutionId,
  parseNodeLocatorId,
  createNodeLocatorId,
  parseNodeExecutionId,
  createNodeExecutionId
} from '@/types/nodeIdentification'
import type { NodeLocatorId, NodeExecutionId } from '@/types/nodeIdentification'

// ── Minimal graph API stub for type-shape tests ─────────────────────────────
// Phase B will provide a real graph API wired to the ECS world.

interface GraphHandle {
  findByType(type: string): unknown[]
  addNode(opts: { type: string; position?: [number, number] }): unknown
  removeNode(handle: unknown): void
  serialize(): object
}

function createMockGraphHandle(): GraphHandle {
  const nodes: Array<{ type: string; id: number }> = []
  let nextId = 1

  return {
    findByType(type: string) {
      return nodes.filter((n) => n.type === type)
    },
    addNode(opts: { type: string }) {
      const node = { type: opts.type, id: nextId++ }
      nodes.push(node)
      return node
    },
    removeNode(handle: unknown) {
      const idx = nodes.indexOf(handle as { type: string; id: number })
      if (idx >= 0) nodes.splice(idx, 1)
    },
    serialize() {
      return { nodes: [...nodes] }
    }
  }
}

describe('BC.29 v2 contract — graph enumeration, mutation, and cross-scope identity', () => {
  describe('S11.G2 — graph enumeration and mutation', () => {
    it('comfyApp.graph.findByType(type) returns an array of matching nodes', () => {
      const graph = createMockGraphHandle()
      graph.addNode({ type: 'KSampler' })
      graph.addNode({ type: 'CLIPTextEncode' })
      graph.addNode({ type: 'KSampler' })

      const found = graph.findByType('KSampler')
      expect(found).toHaveLength(2)
      expect(found.every((n: unknown) => (n as { type: string }).type === 'KSampler')).toBe(true)
    })

    it('comfyApp.graph.addNode(opts) creates and inserts a new node', () => {
      const graph = createMockGraphHandle()
      const node = graph.addNode({ type: 'TestNode' }) as { type: string; id: number }

      expect(node.type).toBe('TestNode')
      expect(node.id).toBeDefined()
      expect(graph.findByType('TestNode')).toHaveLength(1)
    })

    it('comfyApp.graph.removeNode(handle) removes the node from the graph', () => {
      const graph = createMockGraphHandle()
      const node = graph.addNode({ type: 'TestNode' })

      expect(graph.findByType('TestNode')).toHaveLength(1)
      graph.removeNode(node)
      expect(graph.findByType('TestNode')).toHaveLength(0)
    })

    it('comfyApp.graph.serialize() returns a JSON-compatible object', () => {
      const graph = createMockGraphHandle()
      graph.addNode({ type: 'KSampler' })

      const serialized = graph.serialize()
      expect(typeof serialized).toBe('object')
      expect(JSON.stringify(serialized)).toBeDefined()
    })

    it.todo(
      '[Phase B] comfyApp.graph methods return typed NodeHandle objects (requires ECS world)'
    )
  })

  describe('S14.ID1 — cross-subgraph identity helpers', () => {
    describe('NodeLocatorId type guard and parsing', () => {
      it('isNodeLocatorId returns true for valid root graph node IDs', () => {
        expect(isNodeLocatorId('123')).toBe(true)
        expect(isNodeLocatorId('456')).toBe(true)
      })

      it('isNodeLocatorId returns true for valid subgraph node IDs (uuid:localId)', () => {
        expect(isNodeLocatorId('a1b2c3d4-e5f6-7890-abcd-ef1234567890:123')).toBe(true)
      })

      it('isNodeLocatorId returns false for invalid formats', () => {
        expect(isNodeLocatorId('')).toBe(false)
        expect(isNodeLocatorId(null)).toBe(false)
        expect(isNodeLocatorId(123)).toBe(false)
        expect(isNodeLocatorId('invalid-uuid:123')).toBe(false)
      })

      it('parseNodeLocatorId extracts subgraphUuid and localNodeId for subgraph nodes', () => {
        const result = parseNodeLocatorId('a1b2c3d4-e5f6-7890-abcd-ef1234567890:456')

        expect(result).not.toBeNull()
        expect(result!.subgraphUuid).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
        expect(result!.localNodeId).toBe(456)
      })

      it('parseNodeLocatorId returns null subgraphUuid for root graph nodes', () => {
        const result = parseNodeLocatorId('789')

        expect(result).not.toBeNull()
        expect(result!.subgraphUuid).toBeNull()
        expect(result!.localNodeId).toBe(789)
      })

      it('parseNodeLocatorId returns null for invalid inputs', () => {
        expect(parseNodeLocatorId('invalid-uuid:123')).toBeNull()
      })
    })

    describe('NodeLocatorId creation', () => {
      it('createNodeLocatorId produces a colon-delimited string', () => {
        const id = createNodeLocatorId('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 123)

        expect(id).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890:123')
        expect(isNodeLocatorId(id)).toBe(true)
      })

      it('round-trip: createNodeLocatorId → parseNodeLocatorId recovers original values', () => {
        const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
        const localId = 999

        const id = createNodeLocatorId(uuid, localId)
        const parsed = parseNodeLocatorId(id)

        expect(parsed!.subgraphUuid).toBe(uuid)
        expect(parsed!.localNodeId).toBe(localId)
      })
    })

    describe('NodeExecutionId type guard and parsing', () => {
      it('isNodeExecutionId returns true for colon-separated execution paths', () => {
        expect(isNodeExecutionId('123:456')).toBe(true)
        expect(isNodeExecutionId('1:2:3:4')).toBe(true)
      })

      it('isNodeExecutionId returns false for simple node IDs (no colon)', () => {
        // Simple node IDs without colon are NodeLocatorIds, not ExecutionIds
        expect(isNodeExecutionId('123')).toBe(false)
      })

      it('parseNodeExecutionId splits an execution path into node ID array', () => {
        const result = parseNodeExecutionId('65:70:63')

        expect(result).toEqual([65, 70, 63])
      })

      it('parseNodeExecutionId returns null for non-execution IDs', () => {
        expect(parseNodeExecutionId('123')).toBeNull()
      })
    })

    describe('NodeExecutionId creation', () => {
      it('createNodeExecutionId joins an array of node IDs with colons', () => {
        const id = createNodeExecutionId([1, 2, 3])

        expect(id).toBe('1:2:3')
        expect(isNodeExecutionId(id)).toBe(true)
      })

      it('round-trip: createNodeExecutionId → parseNodeExecutionId recovers original array', () => {
        const nodeIds = [100, 200, 300]
        const id = createNodeExecutionId(nodeIds)
        const parsed = parseNodeExecutionId(id)

        expect(parsed).toEqual(nodeIds)
      })
    })

    describe('NodeLocatorId vs NodeExecutionId distinction', () => {
      it('NodeExecutionId reflects runtime execution scope (colon path), not graph scope', () => {
        // An execution ID like "65:70:63" means:
        // - node 63 inside subgraph-node 70 inside subgraph-node 65
        const execId: NodeExecutionId = '65:70:63'
        const parsed = parseNodeExecutionId(execId)

        expect(parsed).toHaveLength(3)
        expect(isNodeExecutionId(execId)).toBe(true)
        // It's also technically a valid locator ID format (has colons), but
        // the meaning is different — locator = uuid:localId, exec = path
      })

      it('NodeLocatorId is stable across all instances of a subgraph', () => {
        // A locator ID like "uuid:123" identifies the same node definition
        // regardless of which execution path reaches it
        const locatorId: NodeLocatorId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890:123'

        expect(isNodeLocatorId(locatorId)).toBe(true)
        const parsed = parseNodeLocatorId(locatorId)
        expect(parsed!.subgraphUuid).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
      })
    })
  })
})
