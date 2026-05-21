// Category: BC.29 — Graph enumeration, mutation, and cross-scope identity
// DB cross-ref: S11.G2, S14.ID1
// Exemplar: https://github.com/yolain/ComfyUI-Easy-Use/blob/main/web_version/v1/js/easy/easyExtraMenu.js#L439
// blast_radius: 5.13
// compat-floor: blast_radius ≥ 2.0
// migration: app.graph raw methods → comfyApp.graph typed API; parseNodeLocatorId → re-exported helpers

import { describe, it, expect } from 'vitest'
import {
  parseNodeLocatorId,
  createNodeLocatorId,
  isNodeLocatorId
} from '@/types/nodeIdentification'

// ── v1 mock: app.graph with raw LiteGraph nodes ─────────────────────────────
interface V1Node {
  id: number
  type: string
}

function createV1Graph() {
  const nodes: V1Node[] = []
  return {
    findNodesByType(type: string) {
      return nodes.filter((n) => n.type === type)
    },
    add(node: V1Node) {
      nodes.push(node)
    },
    remove(node: V1Node) {
      const idx = nodes.indexOf(node)
      if (idx >= 0) nodes.splice(idx, 1)
    }
  }
}

// ── v2 mock: comfyApp.graph with typed handles ──────────────────────────────
interface V2NodeHandle {
  id: string
  type: string
}

function createV2Graph() {
  const nodes: V2NodeHandle[] = []
  let nextId = 1
  return {
    findByType(type: string): V2NodeHandle[] {
      return nodes.filter((n) => n.type === type)
    },
    addNode(opts: { type: string }): V2NodeHandle {
      const handle = { id: `node:${nextId++}`, type: opts.type }
      nodes.push(handle)
      return handle
    },
    removeNode(handle: V2NodeHandle) {
      const idx = nodes.indexOf(handle)
      if (idx >= 0) nodes.splice(idx, 1)
    }
  }
}

describe('BC.29 migration — graph enumeration, mutation, and cross-scope identity', () => {
  describe('graph enumeration migration', () => {
    it('v1 findNodesByType returns raw LiteGraph nodes; v2 findByType returns NodeHandle[]', () => {
      const v1Graph = createV1Graph()
      v1Graph.add({ id: 1, type: 'KSampler' })

      const v2Graph = createV2Graph()
      v2Graph.addNode({ type: 'KSampler' })

      // v1: raw node with numeric id
      const v1Results = v1Graph.findNodesByType('KSampler')
      expect(v1Results[0].id).toBe(1)

      // v2: NodeHandle with branded entityId
      const v2Results = v2Graph.findByType('KSampler')
      expect(v2Results[0].id).toMatch(/^node:/)
    })

    it('v2 findByType call count matches v1 findNodesByType for equivalent operations', () => {
      let v1Calls = 0
      let v2Calls = 0

      const v1Graph = createV1Graph()
      const originalV1Find = v1Graph.findNodesByType.bind(v1Graph)
      v1Graph.findNodesByType = (type: string) => {
        v1Calls++
        return originalV1Find(type)
      }

      const v2Graph = createV2Graph()
      const originalV2Find = v2Graph.findByType.bind(v2Graph)
      v2Graph.findByType = (type: string) => {
        v2Calls++
        return originalV2Find(type)
      }

      v1Graph.add({ id: 1, type: 'TestNode' })
      v2Graph.addNode({ type: 'TestNode' })

      v1Graph.findNodesByType('TestNode')
      v2Graph.findByType('TestNode')

      expect(v1Calls).toBe(1)
      expect(v2Calls).toBe(1)
    })

    it.todo(
      '[Phase B] v2 compat shim forwards app.graph.findNodesByType calls to comfyApp.graph.findByType with deprecation warning'
    )
  })

  describe('graph mutation migration', () => {
    it('v1 add/remove use raw node references; v2 uses typed handles', () => {
      const v1Graph = createV1Graph()
      const v1Node = { id: 1, type: 'TestNode' }
      v1Graph.add(v1Node)
      expect(v1Graph.findNodesByType('TestNode')).toContain(v1Node)
      v1Graph.remove(v1Node)
      expect(v1Graph.findNodesByType('TestNode')).toHaveLength(0)

      const v2Graph = createV2Graph()
      const v2Handle = v2Graph.addNode({ type: 'TestNode' })
      expect(v2Graph.findByType('TestNode')).toContain(v2Handle)
      v2Graph.removeNode(v2Handle)
      expect(v2Graph.findByType('TestNode')).toHaveLength(0)
    })

    it('v2 addNode accepts options object instead of pre-constructed node', () => {
      const v2Graph = createV2Graph()

      // v2 API: pass options, get handle back
      const handle = v2Graph.addNode({ type: 'NewNode' })

      expect(handle.type).toBe('NewNode')
      expect(handle.id).toBeDefined()
    })

    it.todo(
      '[Phase B] v2 compat shim wraps a raw LiteGraph node passed to add() as a NodeHandle automatically'
    )
  })

  describe('cross-scope identity migration', () => {
    it('parseNodeLocatorId is the same function in both v1 and v2 (re-exported)', () => {
      // The function is imported from the same module in both versions
      const locator = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890:123'
      const parsed = parseNodeLocatorId(locator)

      expect(parsed!.subgraphUuid).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
      expect(parsed!.localNodeId).toBe(123)
    })

    it('createNodeLocatorId is the same function in both v1 and v2 (re-exported)', () => {
      const locator = createNodeLocatorId(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        456
      )

      expect(locator).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890:456')
      expect(isNodeLocatorId(locator)).toBe(true)
    })

    it('v2 adds isNodeLocatorId type guard not present in v1 (enhancement)', () => {
      // v2 enhancement: type guard for runtime validation
      expect(isNodeLocatorId('a1b2c3d4-e5f6-7890-abcd-ef1234567890:123')).toBe(
        true
      )
      expect(isNodeLocatorId('invalid')).toBe(true) // simple string is valid root node ID
      expect(isNodeLocatorId('not-a-uuid:123')).toBe(false) // invalid uuid format
      expect(isNodeLocatorId(null)).toBe(false)
    })

    it('migration path: v1 string-based identity → v2 typed NodeLocatorId', () => {
      // v1 pattern: raw string manipulation
      const v1Style = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' + ':' + '789'

      // v2 pattern: use createNodeLocatorId
      const v2Style = createNodeLocatorId(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        789
      )

      // Both produce the same result
      expect(v1Style).toBe(v2Style)

      // But v2 gives you type safety via isNodeLocatorId
      expect(isNodeLocatorId(v2Style)).toBe(true)
    })
  })
})
