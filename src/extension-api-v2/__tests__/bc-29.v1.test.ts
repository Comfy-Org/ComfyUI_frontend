// Category: BC.29 — Graph enumeration, mutation, and cross-scope identity
// DB cross-ref: S11.G2, S14.ID1
// Exemplar: https://github.com/yolain/ComfyUI-Easy-Use/blob/main/web_version/v1/js/easy/easyExtraMenu.js#L439
// blast_radius: 5.13
// compat-floor: blast_radius ≥ 2.0
// v1 contract: app.graph.findNodesByType, app.graph.add/remove, parseNodeLocatorId, createNodeLocatorId

import { describe, it, expect } from 'vitest'
import {
  parseNodeLocatorId,
  createNodeLocatorId
} from '@/types/nodeIdentification'

// ── Minimal v1 LiteGraph mock ───────────────────────────────────────────────
// This mimics the v1 app.graph API shape for contract tests.
// Real LiteGraph wiring is in Phase B.

interface MockLGraphNode {
  id: number
  type: string
}

interface MockLGraph {
  _nodes: MockLGraphNode[]
  _nextId: number
  findNodesByType(type: string): MockLGraphNode[]
  add(node: MockLGraphNode): void
  remove(node: MockLGraphNode): void
  serialize(): { nodes: Array<{ id: number; type: string }> }
  configure(data: { nodes: Array<{ id: number; type: string }> }): void
}

function createMockLGraph(): MockLGraph {
  return {
    _nodes: [],
    _nextId: 1,
    findNodesByType(type: string) {
      return this._nodes.filter((n) => n.type === type)
    },
    add(node: MockLGraphNode) {
      if (!node.id) node.id = this._nextId++
      this._nodes.push(node)
    },
    remove(node: MockLGraphNode) {
      const idx = this._nodes.indexOf(node)
      if (idx >= 0) this._nodes.splice(idx, 1)
    },
    serialize() {
      return { nodes: this._nodes.map((n) => ({ id: n.id, type: n.type })) }
    },
    configure(data: { nodes: Array<{ id: number; type: string }> }) {
      this._nodes = data.nodes.map((n) => ({ id: n.id, type: n.type }))
      this._nextId = Math.max(...data.nodes.map((n) => n.id), 0) + 1
    }
  }
}

describe('BC.29 v1 contract — graph enumeration, mutation, and cross-scope identity', () => {
  describe('S11.G2 — graph enumeration and mutation', () => {
    it('app.graph.findNodesByType returns an array of all matching LiteGraph nodes', () => {
      const graph = createMockLGraph()
      graph.add({ id: 1, type: 'KSampler' })
      graph.add({ id: 2, type: 'CLIPTextEncode' })
      graph.add({ id: 3, type: 'KSampler' })

      const found = graph.findNodesByType('KSampler')

      expect(found).toHaveLength(2)
      expect(found.map((n) => n.id)).toEqual([1, 3])
    })

    it('app.graph.add(node) inserts a pre-constructed LiteGraph node into the live graph', () => {
      const graph = createMockLGraph()
      const node: MockLGraphNode = { id: 10, type: 'TestNode' }

      graph.add(node)

      expect(graph.findNodesByType('TestNode')).toContain(node)
    })

    it('app.graph.remove(node) removes a node from the live graph by reference', () => {
      const graph = createMockLGraph()
      const node: MockLGraphNode = { id: 1, type: 'TestNode' }
      graph.add(node)

      expect(graph.findNodesByType('TestNode')).toHaveLength(1)
      graph.remove(node)
      expect(graph.findNodesByType('TestNode')).toHaveLength(0)
    })

    it('app.graph.serialize() produces a JSON-serializable object representing the full graph state', () => {
      const graph = createMockLGraph()
      graph.add({ id: 1, type: 'NodeA' })
      graph.add({ id: 2, type: 'NodeB' })

      const serialized = graph.serialize()

      expect(serialized.nodes).toHaveLength(2)
      expect(JSON.stringify(serialized)).toBeDefined()
    })

    it('app.graph.configure(json) restores graph state from a previously serialized object', () => {
      const graph = createMockLGraph()
      const data = { nodes: [{ id: 100, type: 'RestoredNode' }] }

      graph.configure(data)

      expect(graph.findNodesByType('RestoredNode')).toHaveLength(1)
      expect(graph.findNodesByType('RestoredNode')[0].id).toBe(100)
    })
  })

  describe('S14.ID1 — cross-subgraph identity helpers', () => {
    it('parseNodeLocatorId(id) splits a locator string into { subgraphUuid, localNodeId } parts', () => {
      const result = parseNodeLocatorId(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890:123'
      )

      expect(result).not.toBeNull()
      expect(result!.subgraphUuid).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
      expect(result!.localNodeId).toBe(123)
    })

    it('createNodeLocatorId(scope, localId) produces a stable colon-delimited locator string', () => {
      const locator = createNodeLocatorId(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        456
      )

      expect(locator).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890:456')
    })

    it('round-tripping createNodeLocatorId → parseNodeLocatorId recovers the original scope and localId', () => {
      const uuid = 'deadbeef-1234-5678-9abc-def012345678'
      const localId = 999

      const locator = createNodeLocatorId(uuid, localId)
      const parsed = parseNodeLocatorId(locator)

      expect(parsed!.subgraphUuid).toBe(uuid)
      expect(parsed!.localNodeId).toBe(localId)
    })

    it('parseNodeLocatorId handles root graph nodes (no subgraph scope)', () => {
      const result = parseNodeLocatorId('42')

      expect(result).not.toBeNull()
      expect(result!.subgraphUuid).toBeNull()
      expect(result!.localNodeId).toBe(42)
    })
  })
})
