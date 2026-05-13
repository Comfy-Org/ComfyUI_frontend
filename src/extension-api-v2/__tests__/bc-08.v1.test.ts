// Category: BC.08 — Programmatic linking
// DB cross-ref: S10.D2
// Exemplar: https://github.com/goodtab/ComfyUI-Custom-Scripts/blob/main/web/js/quickNodes.js#L138
// blast_radius: 5.99 — compat-floor: blast_radius ≥ 2.0 — MUST pass before v2 ships
// v1 contract: node.connect(srcSlot, targetNode, dstSlot)
//              node.disconnectInput(slot)
//
// Phase A: Synthetic mock tests for v1 contract behavior.
// Phase B: Real LiteGraph prototype wiring.

import { describe, expect, it } from 'vitest'

// ── Synthetic types ──────────────────────────────────────────────────────────

interface MockLink {
  id: number
  origin_id: number
  origin_slot: number
  target_id: number
  target_slot: number
}

interface MockSlot {
  name: string
  type: string
  link: number | null
}

interface MockNode {
  id: number
  type: string
  inputs: MockSlot[]
  outputs: MockSlot[]
  onConnectionsChange?: (
    side: number,
    slot: number,
    connect: boolean,
    link: MockLink | null,
    ioSlot: MockSlot
  ) => void
}

interface MockGraph {
  links: Map<number, MockLink>
  add(node: MockNode): void
  getNodeById(id: number): MockNode | undefined
  _createLink(
    srcNode: MockNode,
    srcSlot: number,
    dstNode: MockNode,
    dstSlot: number
  ): MockLink | null
  _removeLink(linkId: number): void
}

// ── Synthetic implementations ────────────────────────────────────────────────

function createMockGraph(): MockGraph {
  const nodes = new Map<number, MockNode>()
  const links = new Map<number, MockLink>()
  let nextLinkId = 1

  return {
    links,
    add(node: MockNode) {
      nodes.set(node.id, node)
    },
    getNodeById(id: number) {
      return nodes.get(id)
    },
    _createLink(srcNode, srcSlot, dstNode, dstSlot) {
      const srcSlotObj = srcNode.outputs[srcSlot]
      const dstSlotObj = dstNode.inputs[dstSlot]

      if (!srcSlotObj || !dstSlotObj) return null

      // Type compatibility check (simplified)
      if (
        srcSlotObj.type !== dstSlotObj.type &&
        srcSlotObj.type !== '*' &&
        dstSlotObj.type !== '*'
      ) {
        return null
      }

      // Remove existing link on target input if any
      if (dstSlotObj.link !== null) {
        this._removeLink(dstSlotObj.link)
      }

      const link: MockLink = {
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

      const srcNode = nodes.get(link.origin_id)
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

interface MockNodeWithMethods extends MockNode {
  connect: (
    srcSlot: number,
    targetNode: MockNodeWithMethods,
    dstSlot: number,
    graph: MockGraph
  ) => MockLink | null
  disconnectInput: (slot: number, graph: MockGraph) => void
}

function createMockNode(
  id: number,
  type: string,
  inputs: Array<{ name: string; type: string }>,
  outputs: Array<{ name: string; type: string }>
): MockNodeWithMethods {
  const node: MockNodeWithMethods = {
    id,
    type,
    inputs: inputs.map((i) => ({ ...i, link: null })),
    outputs: outputs.map((o) => ({ ...o, link: null })),
    onConnectionsChange: undefined,

    connect(
      srcSlot: number,
      targetNode: MockNodeWithMethods,
      dstSlot: number,
      graph: MockGraph
    ) {
      const link = graph._createLink(node, srcSlot, targetNode, dstSlot)

      if (link) {
        // Fire onConnectionsChange on source node (output side, side=2)
        if (node.onConnectionsChange) {
          node.onConnectionsChange(
            2,
            srcSlot,
            true,
            link,
            node.outputs[srcSlot]
          )
        }
        // Fire onConnectionsChange on target node (input side, side=1)
        if (targetNode.onConnectionsChange) {
          targetNode.onConnectionsChange(
            1,
            dstSlot,
            true,
            link,
            targetNode.inputs[dstSlot]
          )
        }
      }

      return link
    },

    disconnectInput(slot: number, graph: MockGraph) {
      const slotObj = node.inputs[slot]
      if (!slotObj || slotObj.link === null) return

      const link = graph.links.get(slotObj.link)
      if (!link) return

      const srcNode = graph.getNodeById(link.origin_id) as
        | MockNodeWithMethods
        | undefined

      graph._removeLink(slotObj.link)

      // Fire onConnectionsChange on target (this node, input side)
      if (node.onConnectionsChange) {
        node.onConnectionsChange(1, slot, false, null, slotObj)
      }
      // Fire onConnectionsChange on source node (output side)
      if (srcNode?.onConnectionsChange) {
        srcNode.onConnectionsChange(
          2,
          link.origin_slot,
          false,
          null,
          srcNode.outputs[link.origin_slot]
        )
      }
    }
  }

  return node
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('BC.08 v1 contract — programmatic linking', () => {
  describe('S10.D2 — node.connect(srcSlot, targetNode, dstSlot)', () => {
    it('node.connect(srcSlot, targetNode, dstSlot) creates a link between the source output slot and the target input slot', () => {
      const graph = createMockGraph()
      const srcNode = createMockNode(
        1,
        'KSampler',
        [],
        [{ name: 'LATENT', type: 'LATENT' }]
      )
      const dstNode = createMockNode(
        2,
        'VAEDecode',
        [{ name: 'samples', type: 'LATENT' }],
        []
      )

      graph.add(srcNode)
      graph.add(dstNode)

      const link = srcNode.connect(0, dstNode, 0, graph)

      expect(link).not.toBeNull()
      expect(link!.origin_id).toBe(1)
      expect(link!.origin_slot).toBe(0)
      expect(link!.target_id).toBe(2)
      expect(link!.target_slot).toBe(0)
    })

    it('connect() returns the newly created link object with a stable numeric id', () => {
      const graph = createMockGraph()
      const srcNode = createMockNode(
        1,
        'KSampler',
        [],
        [{ name: 'LATENT', type: 'LATENT' }]
      )
      const dstNode = createMockNode(
        2,
        'VAEDecode',
        [{ name: 'samples', type: 'LATENT' }],
        []
      )

      graph.add(srcNode)
      graph.add(dstNode)

      const link1 = srcNode.connect(0, dstNode, 0, graph)
      expect(link1).not.toBeNull()
      expect(typeof link1!.id).toBe('number')
      expect(link1!.id).toBeGreaterThan(0)

      // Second link gets next ID
      const dstNode2 = createMockNode(
        3,
        'VAEDecode',
        [{ name: 'samples', type: 'LATENT' }],
        []
      )
      graph.add(dstNode2)
      const link2 = srcNode.connect(0, dstNode2, 0, graph)
      expect(link2!.id).toBe(link1!.id + 1)
    })

    it('connect() on an already-occupied input slot replaces the existing link without leaving a dangling reference', () => {
      const graph = createMockGraph()
      const srcNode1 = createMockNode(
        1,
        'KSampler',
        [],
        [{ name: 'LATENT', type: 'LATENT' }]
      )
      const srcNode2 = createMockNode(
        2,
        'KSampler',
        [],
        [{ name: 'LATENT', type: 'LATENT' }]
      )
      const dstNode = createMockNode(
        3,
        'VAEDecode',
        [{ name: 'samples', type: 'LATENT' }],
        []
      )

      graph.add(srcNode1)
      graph.add(srcNode2)
      graph.add(dstNode)

      const link1 = srcNode1.connect(0, dstNode, 0, graph)
      expect(link1).not.toBeNull()
      expect(dstNode.inputs[0].link).toBe(link1!.id)

      // Replace with a new connection
      const link2 = srcNode2.connect(0, dstNode, 0, graph)
      expect(link2).not.toBeNull()
      expect(dstNode.inputs[0].link).toBe(link2!.id)

      // Old link should be removed from graph
      expect(graph.links.has(link1!.id)).toBe(false)
      expect(graph.links.has(link2!.id)).toBe(true)
    })

    it('connect() with an out-of-bounds slot index returns null', () => {
      const graph = createMockGraph()
      const srcNode = createMockNode(
        1,
        'KSampler',
        [],
        [{ name: 'LATENT', type: 'LATENT' }]
      )
      const dstNode = createMockNode(
        2,
        'VAEDecode',
        [{ name: 'samples', type: 'LATENT' }],
        []
      )

      graph.add(srcNode)
      graph.add(dstNode)

      // Out-of-bounds source slot
      expect(srcNode.connect(99, dstNode, 0, graph)).toBeNull()
      // Out-of-bounds target slot
      expect(srcNode.connect(0, dstNode, 99, graph)).toBeNull()
      // Graph unchanged
      expect(graph.links.size).toBe(0)
    })

    it('connect() with a type-incompatible slot pair is rejected and returns null without modifying the graph', () => {
      const graph = createMockGraph()
      const srcNode = createMockNode(
        1,
        'KSampler',
        [],
        [{ name: 'LATENT', type: 'LATENT' }]
      )
      const dstNode = createMockNode(
        2,
        'SaveImage',
        [{ name: 'images', type: 'IMAGE' }],
        []
      )

      graph.add(srcNode)
      graph.add(dstNode)

      const initialLinkCount = graph.links.size
      const link = srcNode.connect(0, dstNode, 0, graph)

      expect(link).toBeNull()
      expect(graph.links.size).toBe(initialLinkCount)
      expect(dstNode.inputs[0].link).toBeNull()
    })

    it('onConnectionsChange fires on both the source and target node after a successful connect() call', () => {
      const graph = createMockGraph()

      const srcCalls: Array<{ side: number; slot: number; connect: boolean }> =
        []
      const dstCalls: Array<{ side: number; slot: number; connect: boolean }> =
        []

      const srcNode = createMockNode(
        1,
        'KSampler',
        [],
        [{ name: 'LATENT', type: 'LATENT' }]
      )
      const dstNode = createMockNode(
        2,
        'VAEDecode',
        [{ name: 'samples', type: 'LATENT' }],
        []
      )

      // Set handlers before connect
      srcNode.onConnectionsChange = (side, slot, connect) => {
        srcCalls.push({ side, slot, connect })
      }
      dstNode.onConnectionsChange = (side, slot, connect) => {
        dstCalls.push({ side, slot, connect })
      }

      graph.add(srcNode)
      graph.add(dstNode)

      srcNode.connect(0, dstNode, 0, graph)

      expect(srcCalls).toHaveLength(1)
      expect(srcCalls[0]).toEqual({ side: 2, slot: 0, connect: true }) // 2 = output side
      expect(dstCalls).toHaveLength(1)
      expect(dstCalls[0]).toEqual({ side: 1, slot: 0, connect: true }) // 1 = input side
    })
  })

  describe('S10.D2 — node.disconnectInput(slot)', () => {
    it('node.disconnectInput(slot) removes the link on the specified input slot and updates both endpoint nodes', () => {
      const graph = createMockGraph()
      const srcNode = createMockNode(
        1,
        'KSampler',
        [],
        [{ name: 'LATENT', type: 'LATENT' }]
      )
      const dstNode = createMockNode(
        2,
        'VAEDecode',
        [{ name: 'samples', type: 'LATENT' }],
        []
      )

      graph.add(srcNode)
      graph.add(dstNode)

      const link = srcNode.connect(0, dstNode, 0, graph)
      expect(link).not.toBeNull()
      expect(graph.links.size).toBe(1)

      dstNode.disconnectInput(0, graph)

      expect(graph.links.size).toBe(0)
      expect(dstNode.inputs[0].link).toBeNull()
    })

    it('disconnectInput() on an empty slot is a no-op and does not throw', () => {
      const graph = createMockGraph()
      const dstNode = createMockNode(
        1,
        'VAEDecode',
        [{ name: 'samples', type: 'LATENT' }],
        []
      )

      graph.add(dstNode)

      expect(() => dstNode.disconnectInput(0, graph)).not.toThrow()
      expect(dstNode.inputs[0].link).toBeNull()
    })

    it('onConnectionsChange fires on both the source and target node after disconnectInput() removes a link', () => {
      const graph = createMockGraph()

      const srcCalls: Array<{ side: number; slot: number; connect: boolean }> =
        []
      const dstCalls: Array<{ side: number; slot: number; connect: boolean }> =
        []

      const srcNode = createMockNode(
        1,
        'KSampler',
        [],
        [{ name: 'LATENT', type: 'LATENT' }]
      )
      const dstNode = createMockNode(
        2,
        'VAEDecode',
        [{ name: 'samples', type: 'LATENT' }],
        []
      )

      graph.add(srcNode)
      graph.add(dstNode)

      // Connect first (without tracking)
      srcNode.connect(0, dstNode, 0, graph)

      // Clear any calls from connect, set up tracking for disconnect
      srcNode.onConnectionsChange = (side, slot, connect) => {
        srcCalls.push({ side, slot, connect })
      }
      dstNode.onConnectionsChange = (side, slot, connect) => {
        dstCalls.push({ side, slot, connect })
      }

      dstNode.disconnectInput(0, graph)

      expect(dstCalls).toHaveLength(1)
      expect(dstCalls[0]).toEqual({ side: 1, slot: 0, connect: false })
      expect(srcCalls).toHaveLength(1)
      expect(srcCalls[0]).toEqual({ side: 2, slot: 0, connect: false })
    })
  })

  describe('S10.D2 — wildcard/any type slot compatibility', () => {
    it('connect() succeeds when source slot type is "*" (wildcard)', () => {
      const graph = createMockGraph()
      const srcNode = createMockNode(
        1,
        'Reroute',
        [],
        [{ name: 'output', type: '*' }]
      )
      const dstNode = createMockNode(
        2,
        'VAEDecode',
        [{ name: 'samples', type: 'LATENT' }],
        []
      )

      graph.add(srcNode)
      graph.add(dstNode)

      const link = srcNode.connect(0, dstNode, 0, graph)
      expect(link).not.toBeNull()
    })

    it('connect() succeeds when target slot type is "*" (wildcard)', () => {
      const graph = createMockGraph()
      const srcNode = createMockNode(
        1,
        'KSampler',
        [],
        [{ name: 'LATENT', type: 'LATENT' }]
      )
      const dstNode = createMockNode(
        2,
        'Reroute',
        [{ name: 'input', type: '*' }],
        []
      )

      graph.add(srcNode)
      graph.add(dstNode)

      const link = srcNode.connect(0, dstNode, 0, graph)
      expect(link).not.toBeNull()
    })
  })
})
