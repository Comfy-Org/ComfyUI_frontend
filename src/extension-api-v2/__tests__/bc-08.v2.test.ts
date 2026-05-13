// Category: BC.08 — Programmatic linking
// DB cross-ref: S10.D2
// Exemplar: https://github.com/goodtab/ComfyUI-Custom-Scripts/blob/main/web/js/quickNodes.js#L138
// blast_radius: 5.99 — compat-floor: blast_radius ≥ 2.0 — MUST pass before v2 ships
// v2 replacement: NodeHandle.connect(slotIndex, targetHandle, dstSlot) — same semantics, typed handles
//
// Phase A: Synthetic mock tests for v2 contract behavior.
// Phase B: Real ECS World wiring.

import { describe, it, expect } from 'vitest'

// ── Synthetic types mirroring v2 API surface ─────────────────────────────────

interface MockSlot {
  name: string
  type: string
  link: number | null
}

interface MockLink {
  id: number
  origin_id: string
  origin_slot: number
  target_id: string
  target_slot: number
  _invalid?: boolean
}

interface MockWorld {
  links: Map<number, MockLink>
  nodes: Map<string, MockNodeInternal>
  _nextLinkId: number
}

interface MockNodeInternal {
  entityId: string
  type: string
  inputs: MockSlot[]
  outputs: MockSlot[]
  connectionListeners: Array<(e: ConnectionChangeEvent) => void>
}

interface ConnectionChangeEvent {
  side: 'input' | 'output'
  slotIndex: number
  connected: boolean
  linkId: number | null
}

interface LinkHandle {
  readonly id: number
  readonly isValid: () => boolean
}

interface NodeHandle {
  readonly entityId: string
  readonly type: string
  connect(
    srcSlot: number,
    targetHandle: NodeHandle,
    dstSlot: number
  ): LinkHandle | null
  disconnectInput(slotIndex: number): void
  on(event: 'connectionChange', handler: (e: ConnectionChangeEvent) => void): () => void
}

// ── Synthetic implementations ────────────────────────────────────────────────

class TypeMismatchError extends Error {
  constructor(srcType: string, dstType: string) {
    super(`Cannot connect ${srcType} to ${dstType}: type mismatch`)
    this.name = 'TypeMismatchError'
  }
}

function createMockWorld(): MockWorld {
  return {
    links: new Map(),
    nodes: new Map(),
    _nextLinkId: 1
  }
}

function createNodeHandle(
  world: MockWorld,
  entityId: string,
  type: string,
  inputs: Array<{ name: string; type: string }>,
  outputs: Array<{ name: string; type: string }>
): NodeHandle {
  const internal: MockNodeInternal = {
    entityId,
    type,
    inputs: inputs.map((i) => ({ ...i, link: null })),
    outputs: outputs.map((o) => ({ ...o, link: null })),
    connectionListeners: []
  }
  world.nodes.set(entityId, internal)

  const handle: NodeHandle = {
    get entityId() {
      return internal.entityId
    },
    get type() {
      return internal.type
    },

    connect(srcSlot: number, targetHandle: NodeHandle, dstSlot: number): LinkHandle | null {
      const srcSlotObj = internal.outputs[srcSlot]
      const targetInternal = world.nodes.get(targetHandle.entityId)
      if (!targetInternal) return null

      const dstSlotObj = targetInternal.inputs[dstSlot]
      if (!srcSlotObj || !dstSlotObj) return null

      // Type compatibility check
      if (
        srcSlotObj.type !== dstSlotObj.type &&
        srcSlotObj.type !== '*' &&
        dstSlotObj.type !== '*'
      ) {
        throw new TypeMismatchError(srcSlotObj.type, dstSlotObj.type)
      }

      // Remove existing link on target input if any
      if (dstSlotObj.link !== null) {
        const oldLink = world.links.get(dstSlotObj.link)
        if (oldLink) {
          oldLink._invalid = true
          world.links.delete(dstSlotObj.link)
          // Fire connectionChange for disconnect
          internal.connectionListeners.forEach((fn) =>
            fn({ side: 'output', slotIndex: srcSlot, connected: false, linkId: null })
          )
          targetInternal.connectionListeners.forEach((fn) =>
            fn({ side: 'input', slotIndex: dstSlot, connected: false, linkId: null })
          )
        }
        dstSlotObj.link = null
      }

      // Create new link
      const linkId = world._nextLinkId++
      const link: MockLink = {
        id: linkId,
        origin_id: internal.entityId,
        origin_slot: srcSlot,
        target_id: targetInternal.entityId,
        target_slot: dstSlot
      }
      world.links.set(linkId, link)
      dstSlotObj.link = linkId

      // Fire connectionChange on both handles
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

    disconnectInput(slotIndex: number): void {
      const slot = internal.inputs[slotIndex]
      if (!slot || slot.link === null) return

      const link = world.links.get(slot.link)
      if (!link) return

      const srcNode = world.nodes.get(link.origin_id)
      const linkId = slot.link

      // Mark link invalid and remove
      link._invalid = true
      world.links.delete(slot.link)
      slot.link = null

      // Fire connectionChange on target (this node)
      internal.connectionListeners.forEach((fn) =>
        fn({ side: 'input', slotIndex, connected: false, linkId: null })
      )

      // Fire connectionChange on source
      if (srcNode) {
        srcNode.connectionListeners.forEach((fn) =>
          fn({ side: 'output', slotIndex: link.origin_slot, connected: false, linkId: null })
        )
      }
    },

    on(event: 'connectionChange', handler: (e: ConnectionChangeEvent) => void): () => void {
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

// ── Tests ────────────────────────────────────────────────────────────────────

describe('BC.08 v2 contract — programmatic linking', () => {
  describe('NodeHandle.connect(slotIndex, targetHandle, dstSlot) — create links', () => {
    it('NodeHandle.connect(slotIndex, targetHandle, dstSlot) creates a link between the source output slot and the target input slot', () => {
      const world = createMockWorld()
      const srcHandle = createNodeHandle(
        world,
        'node-1',
        'KSampler',
        [],
        [{ name: 'LATENT', type: 'LATENT' }]
      )
      const dstHandle = createNodeHandle(
        world,
        'node-2',
        'VAEDecode',
        [{ name: 'samples', type: 'LATENT' }],
        []
      )

      const linkHandle = srcHandle.connect(0, dstHandle, 0)

      expect(linkHandle).not.toBeNull()
      expect(world.links.size).toBe(1)
      const link = world.links.get(linkHandle!.id)
      expect(link?.origin_id).toBe('node-1')
      expect(link?.origin_slot).toBe(0)
      expect(link?.target_id).toBe('node-2')
      expect(link?.target_slot).toBe(0)
    })

    it('connect() returns a LinkHandle with a stable id that matches the underlying graph link id', () => {
      const world = createMockWorld()
      const srcHandle = createNodeHandle(
        world,
        'node-1',
        'KSampler',
        [],
        [{ name: 'LATENT', type: 'LATENT' }]
      )
      const dstHandle = createNodeHandle(
        world,
        'node-2',
        'VAEDecode',
        [{ name: 'samples', type: 'LATENT' }],
        []
      )

      const linkHandle1 = srcHandle.connect(0, dstHandle, 0)
      expect(linkHandle1).not.toBeNull()
      expect(typeof linkHandle1!.id).toBe('number')
      expect(linkHandle1!.id).toBeGreaterThan(0)
      expect(linkHandle1!.isValid()).toBe(true)

      // Second connect to different node gets next ID
      const dstHandle2 = createNodeHandle(
        world,
        'node-3',
        'VAEDecode',
        [{ name: 'samples', type: 'LATENT' }],
        []
      )
      const linkHandle2 = srcHandle.connect(0, dstHandle2, 0)
      expect(linkHandle2!.id).toBe(linkHandle1!.id + 1)
    })

    it('connect() on an already-occupied input slot replaces the existing link and the old LinkHandle becomes invalid', () => {
      const world = createMockWorld()
      const srcHandle1 = createNodeHandle(
        world,
        'node-1',
        'KSampler',
        [],
        [{ name: 'LATENT', type: 'LATENT' }]
      )
      const srcHandle2 = createNodeHandle(
        world,
        'node-2',
        'KSampler',
        [],
        [{ name: 'LATENT', type: 'LATENT' }]
      )
      const dstHandle = createNodeHandle(
        world,
        'node-3',
        'VAEDecode',
        [{ name: 'samples', type: 'LATENT' }],
        []
      )

      const linkHandle1 = srcHandle1.connect(0, dstHandle, 0)
      expect(linkHandle1).not.toBeNull()
      expect(linkHandle1!.isValid()).toBe(true)

      // Replace with a new connection
      const linkHandle2 = srcHandle2.connect(0, dstHandle, 0)
      expect(linkHandle2).not.toBeNull()
      expect(linkHandle2!.isValid()).toBe(true)

      // Old link handle should be invalid now
      expect(linkHandle1!.isValid()).toBe(false)
      expect(world.links.size).toBe(1)
      expect(world.links.has(linkHandle2!.id)).toBe(true)
    })

    it('connect() with a type-incompatible slot pair throws a typed error and leaves the graph unchanged', () => {
      const world = createMockWorld()
      const srcHandle = createNodeHandle(
        world,
        'node-1',
        'KSampler',
        [],
        [{ name: 'LATENT', type: 'LATENT' }]
      )
      const dstHandle = createNodeHandle(
        world,
        'node-2',
        'SaveImage',
        [{ name: 'images', type: 'IMAGE' }],
        []
      )

      const initialLinkCount = world.links.size
      expect(() => srcHandle.connect(0, dstHandle, 0)).toThrow(TypeMismatchError)
      expect(world.links.size).toBe(initialLinkCount)
    })

    it("on('connectionChange') fires on both NodeHandles after a successful connect() call", () => {
      const world = createMockWorld()
      const srcCalls: ConnectionChangeEvent[] = []
      const dstCalls: ConnectionChangeEvent[] = []

      const srcHandle = createNodeHandle(
        world,
        'node-1',
        'KSampler',
        [],
        [{ name: 'LATENT', type: 'LATENT' }]
      )
      const dstHandle = createNodeHandle(
        world,
        'node-2',
        'VAEDecode',
        [{ name: 'samples', type: 'LATENT' }],
        []
      )

      srcHandle.on('connectionChange', (e) => srcCalls.push(e))
      dstHandle.on('connectionChange', (e) => dstCalls.push(e))

      const linkHandle = srcHandle.connect(0, dstHandle, 0)

      expect(srcCalls).toHaveLength(1)
      expect(srcCalls[0].side).toBe('output')
      expect(srcCalls[0].slotIndex).toBe(0)
      expect(srcCalls[0].connected).toBe(true)
      expect(srcCalls[0].linkId).toBe(linkHandle!.id)

      expect(dstCalls).toHaveLength(1)
      expect(dstCalls[0].side).toBe('input')
      expect(dstCalls[0].slotIndex).toBe(0)
      expect(dstCalls[0].connected).toBe(true)
      expect(dstCalls[0].linkId).toBe(linkHandle!.id)
    })
  })

  describe('NodeHandle.disconnectInput(slotIndex) — remove links', () => {
    it('NodeHandle.disconnectInput(slotIndex) removes the link on the specified input slot and the returned LinkHandle becomes invalid', () => {
      const world = createMockWorld()
      const srcHandle = createNodeHandle(
        world,
        'node-1',
        'KSampler',
        [],
        [{ name: 'LATENT', type: 'LATENT' }]
      )
      const dstHandle = createNodeHandle(
        world,
        'node-2',
        'VAEDecode',
        [{ name: 'samples', type: 'LATENT' }],
        []
      )

      const linkHandle = srcHandle.connect(0, dstHandle, 0)
      expect(linkHandle).not.toBeNull()
      expect(linkHandle!.isValid()).toBe(true)
      expect(world.links.size).toBe(1)

      dstHandle.disconnectInput(0)

      expect(world.links.size).toBe(0)
      expect(linkHandle!.isValid()).toBe(false)
    })

    it('disconnectInput() on an empty slot is a no-op and does not throw', () => {
      const world = createMockWorld()
      const dstHandle = createNodeHandle(
        world,
        'node-1',
        'VAEDecode',
        [{ name: 'samples', type: 'LATENT' }],
        []
      )

      expect(() => dstHandle.disconnectInput(0)).not.toThrow()
      expect(world.links.size).toBe(0)
    })

    it("on('connectionChange') fires on both source and target NodeHandles after disconnectInput() removes a link", () => {
      const world = createMockWorld()
      const srcCalls: ConnectionChangeEvent[] = []
      const dstCalls: ConnectionChangeEvent[] = []

      const srcHandle = createNodeHandle(
        world,
        'node-1',
        'KSampler',
        [],
        [{ name: 'LATENT', type: 'LATENT' }]
      )
      const dstHandle = createNodeHandle(
        world,
        'node-2',
        'VAEDecode',
        [{ name: 'samples', type: 'LATENT' }],
        []
      )

      // Connect first (without tracking)
      srcHandle.connect(0, dstHandle, 0)

      // Set up tracking for disconnect
      srcHandle.on('connectionChange', (e) => srcCalls.push(e))
      dstHandle.on('connectionChange', (e) => dstCalls.push(e))

      dstHandle.disconnectInput(0)

      expect(dstCalls).toHaveLength(1)
      expect(dstCalls[0].side).toBe('input')
      expect(dstCalls[0].slotIndex).toBe(0)
      expect(dstCalls[0].connected).toBe(false)

      expect(srcCalls).toHaveLength(1)
      expect(srcCalls[0].side).toBe('output')
      expect(srcCalls[0].slotIndex).toBe(0)
      expect(srcCalls[0].connected).toBe(false)
    })
  })
})
