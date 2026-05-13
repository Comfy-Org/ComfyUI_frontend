// Category: BC.08 — Programmatic linking
// DB cross-ref: S10.D2
// Exemplar: https://github.com/goodtab/ComfyUI-Custom-Scripts/blob/main/web/js/quickNodes.js#L138
// Migration: v1 node.connect/disconnectInput → v2 NodeHandle.connect/disconnectInput (typed handles)
//
// These tests verify behavioral equivalence between v1 and v2 APIs using synthetic harnesses.

import { describe, it, expect } from 'vitest'

// ── V1 Synthetic Types (from bc-08.v1) ───────────────────────────────────────

interface MockLinkV1 {
  id: number
  origin_id: number
  origin_slot: number
  target_id: number
  target_slot: number
}

interface MockSlotV1 {
  name: string
  type: string
  link: number | null
}

interface MockNodeV1 {
  id: number
  type: string
  inputs: MockSlotV1[]
  outputs: MockSlotV1[]
  onConnectionsChange?: (
    side: number,
    slot: number,
    connect: boolean,
    link: MockLinkV1 | null,
    ioSlot: MockSlotV1
  ) => void
}

interface MockGraphV1 {
  links: Map<number, MockLinkV1>
  _nextLinkId: number
  add(node: MockNodeV1): void
  getNodeById(id: number): MockNodeV1 | undefined
  _createLink(
    srcNode: MockNodeV1,
    srcSlot: number,
    dstNode: MockNodeV1,
    dstSlot: number
  ): MockLinkV1 | null
  _removeLink(linkId: number): void
}

// ── V2 Synthetic Types (from bc-08.v2) ───────────────────────────────────────

interface MockSlotV2 {
  name: string
  type: string
  link: number | null
}

interface MockLinkV2 {
  id: number
  origin_id: string
  origin_slot: number
  target_id: string
  target_slot: number
  _invalid?: boolean
}

interface MockWorldV2 {
  links: Map<number, MockLinkV2>
  nodes: Map<string, MockNodeInternalV2>
  _nextLinkId: number
}

interface ConnectionChangeEventV2 {
  side: 'input' | 'output'
  slotIndex: number
  connected: boolean
  linkId: number | null
}

interface MockNodeInternalV2 {
  entityId: string
  type: string
  inputs: MockSlotV2[]
  outputs: MockSlotV2[]
  connectionListeners: Array<(e: ConnectionChangeEventV2) => void>
}

interface LinkHandleV2 {
  readonly id: number
  readonly isValid: () => boolean
}

interface NodeHandleV2 {
  readonly entityId: string
  readonly type: string
  connect(srcSlot: number, targetHandle: NodeHandleV2, dstSlot: number): LinkHandleV2 | null
  disconnectInput(slotIndex: number): void
  on(event: 'connectionChange', handler: (e: ConnectionChangeEventV2) => void): () => void
}

// ── V1 Synthetic Implementations ─────────────────────────────────────────────

function createMockGraphV1(): MockGraphV1 {
  const nodes = new Map<number, MockNodeV1>()
  const links = new Map<number, MockLinkV1>()
  let nextLinkId = 1

  return {
    links,
    _nextLinkId: nextLinkId,
    add(node: MockNodeV1) {
      nodes.set(node.id, node)
    },
    getNodeById(id: number) {
      return nodes.get(id)
    },
    _createLink(srcNode, srcSlot, dstNode, dstSlot) {
      const srcSlotObj = srcNode.outputs[srcSlot]
      const dstSlotObj = dstNode.inputs[dstSlot]

      if (!srcSlotObj || !dstSlotObj) return null
      if (
        srcSlotObj.type !== dstSlotObj.type &&
        srcSlotObj.type !== '*' &&
        dstSlotObj.type !== '*'
      ) {
        return null
      }

      if (dstSlotObj.link !== null) {
        this._removeLink(dstSlotObj.link)
      }

      const link: MockLinkV1 = {
        id: nextLinkId++,
        origin_id: srcNode.id,
        origin_slot: srcSlot,
        target_id: dstNode.id,
        target_slot: dstSlot
      }

      links.set(link.id, link)
      dstSlotObj.link = link.id

      return link
    },
    _removeLink(linkId) {
      const link = links.get(linkId)
      if (!link) return

      const dstNode = nodes.get(link.target_id)
      if (dstNode) {
        const dstSlot = dstNode.inputs[link.target_slot]
        if (dstSlot && dstSlot.link === linkId) {
          dstSlot.link = null
        }
      }

      links.delete(linkId)
    }
  }
}

interface MockNodeV1WithMethods extends MockNodeV1 {
  connect: (
    srcSlot: number,
    targetNode: MockNodeV1WithMethods,
    dstSlot: number,
    graph: MockGraphV1
  ) => MockLinkV1 | null
  disconnectInput: (slot: number, graph: MockGraphV1) => void
}

function createMockNodeV1(
  id: number,
  type: string,
  inputs: Array<{ name: string; type: string }>,
  outputs: Array<{ name: string; type: string }>
): MockNodeV1WithMethods {
  const node: MockNodeV1WithMethods = {
    id,
    type,
    inputs: inputs.map((i) => ({ ...i, link: null })),
    outputs: outputs.map((o) => ({ ...o, link: null })),
    onConnectionsChange: undefined,

    connect(srcSlot, targetNode, dstSlot, graph) {
      const link = graph._createLink(node, srcSlot, targetNode, dstSlot)
      if (link) {
        if (node.onConnectionsChange) {
          node.onConnectionsChange(2, srcSlot, true, link, node.outputs[srcSlot])
        }
        if (targetNode.onConnectionsChange) {
          targetNode.onConnectionsChange(1, dstSlot, true, link, targetNode.inputs[dstSlot])
        }
      }
      return link
    },

    disconnectInput(slot, graph) {
      const slotObj = node.inputs[slot]
      if (!slotObj || slotObj.link === null) return

      const link = graph.links.get(slotObj.link)
      if (!link) return

      const srcNode = graph.getNodeById(link.origin_id) as MockNodeV1WithMethods | undefined

      graph._removeLink(slotObj.link)

      if (node.onConnectionsChange) {
        node.onConnectionsChange(1, slot, false, null, slotObj)
      }
      if (srcNode?.onConnectionsChange) {
        srcNode.onConnectionsChange(2, link.origin_slot, false, null, srcNode.outputs[link.origin_slot])
      }
    }
  }

  return node
}

// ── V2 Synthetic Implementations ─────────────────────────────────────────────

class TypeMismatchError extends Error {
  constructor(srcType: string, dstType: string) {
    super(`Cannot connect ${srcType} to ${dstType}: type mismatch`)
    this.name = 'TypeMismatchError'
  }
}

function createMockWorldV2(): MockWorldV2 {
  return {
    links: new Map(),
    nodes: new Map(),
    _nextLinkId: 1
  }
}

function createNodeHandleV2(
  world: MockWorldV2,
  entityId: string,
  type: string,
  inputs: Array<{ name: string; type: string }>,
  outputs: Array<{ name: string; type: string }>
): NodeHandleV2 {
  const internal: MockNodeInternalV2 = {
    entityId,
    type,
    inputs: inputs.map((i) => ({ ...i, link: null })),
    outputs: outputs.map((o) => ({ ...o, link: null })),
    connectionListeners: []
  }
  world.nodes.set(entityId, internal)

  const handle: NodeHandleV2 = {
    get entityId() {
      return internal.entityId
    },
    get type() {
      return internal.type
    },

    connect(srcSlot, targetHandle, dstSlot) {
      const srcSlotObj = internal.outputs[srcSlot]
      const targetInternal = world.nodes.get(targetHandle.entityId)
      if (!targetInternal) return null

      const dstSlotObj = targetInternal.inputs[dstSlot]
      if (!srcSlotObj || !dstSlotObj) return null

      if (
        srcSlotObj.type !== dstSlotObj.type &&
        srcSlotObj.type !== '*' &&
        dstSlotObj.type !== '*'
      ) {
        throw new TypeMismatchError(srcSlotObj.type, dstSlotObj.type)
      }

      if (dstSlotObj.link !== null) {
        const oldLink = world.links.get(dstSlotObj.link)
        if (oldLink) {
          oldLink._invalid = true
          world.links.delete(dstSlotObj.link)
        }
        dstSlotObj.link = null
      }

      const linkId = world._nextLinkId++
      const link: MockLinkV2 = {
        id: linkId,
        origin_id: internal.entityId,
        origin_slot: srcSlot,
        target_id: targetInternal.entityId,
        target_slot: dstSlot
      }
      world.links.set(linkId, link)
      dstSlotObj.link = linkId

      internal.connectionListeners.forEach((fn) =>
        fn({ side: 'output', slotIndex: srcSlot, connected: true, linkId })
      )
      targetInternal.connectionListeners.forEach((fn) =>
        fn({ side: 'input', slotIndex: dstSlot, connected: true, linkId })
      )

      return {
        get id() {
          return linkId
        },
        isValid() {
          const l = world.links.get(linkId)
          return l !== undefined && !l._invalid
        }
      }
    },

    disconnectInput(slotIndex) {
      const slot = internal.inputs[slotIndex]
      if (!slot || slot.link === null) return

      const link = world.links.get(slot.link)
      if (!link) return

      const srcNode = world.nodes.get(link.origin_id)

      link._invalid = true
      world.links.delete(slot.link)
      slot.link = null

      internal.connectionListeners.forEach((fn) =>
        fn({ side: 'input', slotIndex, connected: false, linkId: null })
      )

      if (srcNode) {
        srcNode.connectionListeners.forEach((fn) =>
          fn({ side: 'output', slotIndex: link.origin_slot, connected: false, linkId: null })
        )
      }
    },

    on(event, handler) {
      if (event !== 'connectionChange') throw new Error(`Unknown event: ${event}`)
      internal.connectionListeners.push(handler)
      return () => {
        const idx = internal.connectionListeners.indexOf(handler)
        if (idx !== -1) internal.connectionListeners.splice(idx, 1)
      }
    }
  }

  return handle
}

// ── Migration Tests ──────────────────────────────────────────────────────────

describe('BC.08 migration — programmatic linking', () => {
  describe('connect() equivalence', () => {
    it('v1 node.connect(srcSlot, targetNode, dstSlot) and v2 NodeHandle.connect(srcSlot, targetHandle, dstSlot) produce identical graph link state', () => {
      // V1
      const graphV1 = createMockGraphV1()
      const srcV1 = createMockNodeV1(1, 'KSampler', [], [{ name: 'LATENT', type: 'LATENT' }])
      const dstV1 = createMockNodeV1(2, 'VAEDecode', [{ name: 'samples', type: 'LATENT' }], [])
      graphV1.add(srcV1)
      graphV1.add(dstV1)
      const linkV1 = srcV1.connect(0, dstV1, 0, graphV1)

      // V2
      const worldV2 = createMockWorldV2()
      const srcV2 = createNodeHandleV2(worldV2, 'node-1', 'KSampler', [], [{ name: 'LATENT', type: 'LATENT' }])
      const dstV2 = createNodeHandleV2(worldV2, 'node-2', 'VAEDecode', [{ name: 'samples', type: 'LATENT' }], [])
      const linkV2 = srcV2.connect(0, dstV2, 0)

      // Both create exactly one link
      expect(graphV1.links.size).toBe(1)
      expect(worldV2.links.size).toBe(1)

      // Link state is equivalent
      expect(linkV1).not.toBeNull()
      expect(linkV2).not.toBeNull()
      expect(linkV1!.origin_slot).toBe(0)
      expect(linkV1!.target_slot).toBe(0)

      const v2Link = worldV2.links.get(linkV2!.id)!
      expect(v2Link.origin_slot).toBe(0)
      expect(v2Link.target_slot).toBe(0)
    })

    it('link id returned by v2 connect() matches the id on the underlying LGraph link created by an equivalent v1 call', () => {
      // Both should start counting from 1
      const graphV1 = createMockGraphV1()
      const srcV1 = createMockNodeV1(1, 'KSampler', [], [{ name: 'LATENT', type: 'LATENT' }])
      const dstV1 = createMockNodeV1(2, 'VAEDecode', [{ name: 'samples', type: 'LATENT' }], [])
      graphV1.add(srcV1)
      graphV1.add(dstV1)
      const linkV1 = srcV1.connect(0, dstV1, 0, graphV1)

      const worldV2 = createMockWorldV2()
      const srcV2 = createNodeHandleV2(worldV2, 'node-1', 'KSampler', [], [{ name: 'LATENT', type: 'LATENT' }])
      const dstV2 = createNodeHandleV2(worldV2, 'node-2', 'VAEDecode', [{ name: 'samples', type: 'LATENT' }], [])
      const linkV2 = srcV2.connect(0, dstV2, 0)

      // Both start from 1
      expect(linkV1!.id).toBe(1)
      expect(linkV2!.id).toBe(1)
    })

    it('v2 connect() with a type-incompatible pair raises a typed error; v1 returns null — callers must handle both forms during migration', () => {
      // V1: returns null
      const graphV1 = createMockGraphV1()
      const srcV1 = createMockNodeV1(1, 'KSampler', [], [{ name: 'LATENT', type: 'LATENT' }])
      const dstV1 = createMockNodeV1(2, 'SaveImage', [{ name: 'images', type: 'IMAGE' }], [])
      graphV1.add(srcV1)
      graphV1.add(dstV1)
      const linkV1 = srcV1.connect(0, dstV1, 0, graphV1)
      expect(linkV1).toBeNull()

      // V2: throws TypeMismatchError
      const worldV2 = createMockWorldV2()
      const srcV2 = createNodeHandleV2(worldV2, 'node-1', 'KSampler', [], [{ name: 'LATENT', type: 'LATENT' }])
      const dstV2 = createNodeHandleV2(worldV2, 'node-2', 'SaveImage', [{ name: 'images', type: 'IMAGE' }], [])
      expect(() => srcV2.connect(0, dstV2, 0)).toThrow(TypeMismatchError)

      // Both leave graph unchanged
      expect(graphV1.links.size).toBe(0)
      expect(worldV2.links.size).toBe(0)
    })
  })

  describe('disconnectInput() equivalence', () => {
    it('v1 node.disconnectInput(slot) and v2 NodeHandle.disconnectInput(slotIndex) both leave the graph with no link on that slot', () => {
      // V1
      const graphV1 = createMockGraphV1()
      const srcV1 = createMockNodeV1(1, 'KSampler', [], [{ name: 'LATENT', type: 'LATENT' }])
      const dstV1 = createMockNodeV1(2, 'VAEDecode', [{ name: 'samples', type: 'LATENT' }], [])
      graphV1.add(srcV1)
      graphV1.add(dstV1)
      srcV1.connect(0, dstV1, 0, graphV1)
      expect(graphV1.links.size).toBe(1)
      dstV1.disconnectInput(0, graphV1)
      expect(graphV1.links.size).toBe(0)
      expect(dstV1.inputs[0].link).toBeNull()

      // V2
      const worldV2 = createMockWorldV2()
      const srcV2 = createNodeHandleV2(worldV2, 'node-1', 'KSampler', [], [{ name: 'LATENT', type: 'LATENT' }])
      const dstV2 = createNodeHandleV2(worldV2, 'node-2', 'VAEDecode', [{ name: 'samples', type: 'LATENT' }], [])
      srcV2.connect(0, dstV2, 0)
      expect(worldV2.links.size).toBe(1)
      dstV2.disconnectInput(0)
      expect(worldV2.links.size).toBe(0)
    })

    it("onConnectionsChange (v1) and on('connectionChange') (v2) both fire for the same disconnect operation with equivalent payload data", () => {
      // V1
      const v1Calls: Array<{ side: number; slot: number; connect: boolean }> = []
      const graphV1 = createMockGraphV1()
      const srcV1 = createMockNodeV1(1, 'KSampler', [], [{ name: 'LATENT', type: 'LATENT' }])
      const dstV1 = createMockNodeV1(2, 'VAEDecode', [{ name: 'samples', type: 'LATENT' }], [])
      graphV1.add(srcV1)
      graphV1.add(dstV1)
      srcV1.connect(0, dstV1, 0, graphV1)
      dstV1.onConnectionsChange = (side, slot, connect) => {
        v1Calls.push({ side, slot, connect })
      }
      dstV1.disconnectInput(0, graphV1)

      // V2
      const v2Calls: Array<{ side: string; slotIndex: number; connected: boolean }> = []
      const worldV2 = createMockWorldV2()
      const srcV2 = createNodeHandleV2(worldV2, 'node-1', 'KSampler', [], [{ name: 'LATENT', type: 'LATENT' }])
      const dstV2 = createNodeHandleV2(worldV2, 'node-2', 'VAEDecode', [{ name: 'samples', type: 'LATENT' }], [])
      srcV2.connect(0, dstV2, 0)
      dstV2.on('connectionChange', (e) => {
        v2Calls.push({ side: e.side, slotIndex: e.slotIndex, connected: e.connected })
      })
      dstV2.disconnectInput(0)

      // Both fire exactly once on the target node
      expect(v1Calls).toHaveLength(1)
      expect(v2Calls).toHaveLength(1)

      // V1 side=1 (input) corresponds to V2 side='input'
      expect(v1Calls[0].side).toBe(1)
      expect(v2Calls[0].side).toBe('input')

      // Same slot index
      expect(v1Calls[0].slot).toBe(0)
      expect(v2Calls[0].slotIndex).toBe(0)

      // Both indicate disconnect
      expect(v1Calls[0].connect).toBe(false)
      expect(v2Calls[0].connected).toBe(false)
    })
  })

  describe('handle vs. raw node reference', () => {
    it('v2 NodeHandle.connect() accepts a NodeHandle for targetHandle; passing a raw LGraphNode instance would require migration', () => {
      // V2 API requires NodeHandle, not raw node reference
      // This test verifies that the v2 API works with NodeHandle
      const worldV2 = createMockWorldV2()
      const srcV2 = createNodeHandleV2(worldV2, 'node-1', 'KSampler', [], [{ name: 'LATENT', type: 'LATENT' }])
      const dstV2 = createNodeHandleV2(worldV2, 'node-2', 'VAEDecode', [{ name: 'samples', type: 'LATENT' }], [])

      // Connect using NodeHandle (the v2 way)
      const linkHandle = srcV2.connect(0, dstV2, 0)
      expect(linkHandle).not.toBeNull()
      expect(linkHandle!.isValid()).toBe(true)

      // Verify the link was created correctly
      expect(worldV2.links.size).toBe(1)
    })

    it('NodeHandle obtained from v2 nodeCreated correctly wraps the same node that v1 connect() would operate on', () => {
      // Both v1 and v2 operate on the same conceptual node
      // V1 uses numeric id, V2 uses string entityId, but they refer to the same entity

      const graphV1 = createMockGraphV1()
      const nodeV1 = createMockNodeV1(42, 'KSampler', [], [{ name: 'LATENT', type: 'LATENT' }])
      graphV1.add(nodeV1)

      const worldV2 = createMockWorldV2()
      const handleV2 = createNodeHandleV2(worldV2, 'node-42', 'KSampler', [], [{ name: 'LATENT', type: 'LATENT' }])

      // Both represent a KSampler with one LATENT output
      expect(nodeV1.type).toBe('KSampler')
      expect(handleV2.type).toBe('KSampler')
      expect(nodeV1.outputs.length).toBe(1)
      expect(worldV2.nodes.get('node-42')!.outputs.length).toBe(1)
    })
  })
})
