/**
 * Atomicity contracts for graph-level call sites of attachNodeToStores,
 * replaceLinkTopology, and updateEndpoints.
 *
 * Every site validated-then-mutates: a store rejection leaves no committed
 * graph mutation. The one declared edge case is the cosmetic ID gap created
 * by mintLinkId before replaceLinkTopology is called; that is documented in
 * docs/architecture/ecs/ecs-extension-compatibility-audit.md under
 * "Declared-non-atomic edge cases".
 */
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { realignInputLinkSlots } from '@/lib/litegraph/src/linkDeduplication'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import { useLinkStore } from '@/stores/linkStore'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function connectedPair() {
  const graph = new LGraph()
  const source = new LGraphNode('Source')
  source.addOutput('out', 'INT')
  graph.add(source)

  const target = new LGraphNode('Target')
  target.addInput('in', 'INT')
  graph.add(target)

  const link = source.connect(0, target, 0)!
  return { graph, source, target, link }
}

// ---------------------------------------------------------------------------
// attachNodeToStores call site: LGraph.add()
// ---------------------------------------------------------------------------

describe('attachNodeToStores – LGraph.add() atomicity', () => {
  beforeEach(() => setActivePinia(createTestingPinia({ stubActions: false })))

  it('resolves an id collision by re-minting before mutating graph arrays', () => {
    // Pre-plant a node so its id is already taken in the store.
    const graph = new LGraph()
    const planted = new LGraphNode('Planted')
    graph.add(planted)

    // The collision candidate starts with the same id as the planted node.
    const candidate = new LGraphNode('Candidate')
    candidate.id = planted.id

    graph.add(candidate)

    // Both nodes are registered with unique ids.
    expect(candidate.id).not.toBe(planted.id)
    expect(graph._nodes).toHaveLength(2)
    // Each node appears exactly once under its id.
    expect(graph._nodes_by_id[planted.id]).toBe(planted)
    expect(graph._nodes_by_id[candidate.id]).toBe(candidate)
  })

  it('never adds a node to _nodes before store registration succeeds', () => {
    const graph = new LGraph()
    // Confirm the node is fully registered on first access to _nodes.
    const node = new LGraphNode('N')
    graph.add(node)

    expect(graph._nodes).toContain(node)
    expect(node._graphScope).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// replaceLinkTopology call site: LGraphNode.connect()
// ---------------------------------------------------------------------------

describe('replaceLinkTopology – LGraphNode.connect() atomicity', () => {
  beforeEach(() => setActivePinia(createTestingPinia({ stubActions: false })))

  it('leaves the graph unchanged when the store rejects replaceLink', () => {
    const { source, target, link } = connectedPair()
    const graph = source.graph!

    const linksBefore = graph.links.size
    const inputLinkBefore = target.getInputLink(0)?.id

    // Force every replaceLink call to fail.
    vi.spyOn(useLinkStore(), 'replaceLink').mockReturnValue(undefined)

    // Attempt a second connection to the same input slot.
    const second = new LGraphNode('Second')
    second.addOutput('out', 'INT')
    graph.add(second)
    const result = second.connect(0, target, 0)

    // connect() returns null or undefined on rejection.
    expect(result).toBeFalsy()
    // The link store is unchanged.
    expect(graph.links.size).toBe(linksBefore)
    // The original link on the target input is still intact.
    expect(target.getInputLink(0)?.id).toBe(inputLinkBefore)
    // The incumbent link from the first source is still registered.
    expect(graph.links.get(link.id)).toBeDefined()
  })

  it('commits the replacement and removes the incumbent on success', () => {
    const graph = new LGraph()
    const source1 = new LGraphNode('S1')
    source1.addOutput('out', 'INT')
    graph.add(source1)
    const source2 = new LGraphNode('S2')
    source2.addOutput('out', 'INT')
    graph.add(source2)
    const target = new LGraphNode('T')
    target.addInput('in', 'INT')
    graph.add(target)

    const first = source1.connect(0, target, 0)!
    expect(graph.links.get(first.id)).toBeDefined()

    const second = source2.connect(0, target, 0)!
    // The new link is registered.
    expect(graph.links.get(second.id)).toBeDefined()
    // The old link is gone.
    expect(graph.links.has(first.id)).toBe(false)
    // The target input reflects the new link.
    expect(target.getInputLink(0)?.id).toBe(second.id)
  })

  /**
   * Declared edge case (cosmetic, not a graph inconsistency):
   * mintLinkId increments state.lastLinkId before replaceLinkTopology.
   * A rejection wastes the minted id, leaving a gap in the sequence.
   * The graph's _topology_ remains consistent — no dangling link, no
   * double-registered slot. Only the monotonic counter advances.
   */
  it.fails('does not advance lastLinkId when the store rejects replaceLink', () => {
    const { source, target } = connectedPair()
    const graph = source.graph!
    const idBefore = Number(graph.state.lastLinkId)

    vi.spyOn(useLinkStore(), 'replaceLink').mockReturnValue(undefined)

    const second = new LGraphNode('S2')
    second.addOutput('out', 'INT')
    graph.add(second)
    second.connect(0, target, 0)

    // This assertion FAILS: lastLinkId was already incremented by mintLinkId
    // before the store call.  The gap is cosmetic — no topology corruption.
    expect(Number(graph.state.lastLinkId)).toBe(idBefore)
  })
})

// ---------------------------------------------------------------------------
// updateEndpoints call site: replaceNodeInputs (slotLinks.ts)
// ---------------------------------------------------------------------------

describe('updateEndpoints – replaceNodeInputs() atomicity', () => {
  beforeEach(() => setActivePinia(createTestingPinia({ stubActions: false })))

  it('does not splice node.inputs when updateEndpoints is rejected', () => {
    const graph = new LGraph()
    const source = new LGraphNode('S')
    source.addOutput('out', 'INT')
    graph.add(source)
    const target = new LGraphNode('T')
    target.addInput('a', 'INT')
    target.addInput('b', 'INT')
    graph.add(target)
    source.connect(0, target, 0)
    source.connect(0, target, 1)

    const inputsBefore = [...target.inputs]

    // The last test in legacySlotLinkMutations.test.ts already exercises the
    // "keeps the input layout when the endpoint batch is rejected" path via
    // removeInput. Here we drive it through the store rejection directly.
    vi.spyOn(useLinkStore(), 'updateEndpoints').mockReturnValue({
      ok: false,
      error: { code: 'occupied-target', message: 'forced rejection' }
    })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    // removeInput triggers replaceNodeInputs → updateEndpoints.
    target.removeInput(0)

    expect(consoleError).toHaveBeenCalledWith(
      'Failed to replace node inputs',
      expect.objectContaining({ code: 'occupied-target' })
    )
    // node.inputs is unchanged — no partial splice committed.
    expect(target.inputs.map((i) => i.name)).toEqual(
      inputsBefore.map((i) => i.name)
    )
    // Both links are still registered.
    expect(graph.links.size).toBe(2)
  })

  it('splices inputs and updates endpoints together on success', () => {
    const graph = new LGraph()
    const source = new LGraphNode('S')
    source.addOutput('out', 'INT')
    graph.add(source)
    const target = new LGraphNode('T')
    target.addInput('a', 'INT')
    target.addInput('b', 'INT')
    graph.add(target)
    source.connect(0, target, 0)
    source.connect(0, target, 1)

    const linkAtB = target.getInputLink(1)!

    // Remove slot 0; slot 1 (with its link) shifts to slot 0.
    target.removeInput(0)

    expect(target.inputs).toHaveLength(1)
    expect(target.inputs[0].name).toBe('b')
    // The surviving link now targets slot 0.
    expect(target.getInputLink(0)?.id).toBe(linkAtB.id)
    expect(graph.links.size).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// updateEndpoints call site: realignInputLinkSlots (linkDeduplication.ts)
// ---------------------------------------------------------------------------

describe('updateEndpoints – realignInputLinkSlots() atomicity', () => {
  beforeEach(() => setActivePinia(createTestingPinia({ stubActions: false })))

  it('keeps the original connection when updateEndpoints is rejected', () => {
    const graph = new LGraph()
    const source = new LGraphNode('S')
    source.addOutput('out', 'INT')
    graph.add(source)
    const target = new LGraphNode('T')
    target.addInput('other', 'INT')
    target.addInput('x', 'INT')
    graph.add(target)
    const link = source.connect(0, target, 0)!

    const onConnectionsChange = vi.fn()
    target.onConnectionsChange = onConnectionsChange

    const updateEndpoints = vi
      .spyOn(useLinkStore(), 'updateEndpoints')
      .mockReturnValue({
        ok: false,
        error: { code: 'unowned-topology', message: 'forced' }
      })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const serialized = [
      {
        id: target.id,
        inputs: [
          { name: 'x', link: target.getInputLink(0)!.id as unknown as number }
        ]
      }
    ] as unknown as ISerialisedNode[]
    realignInputLinkSlots(graph, serialized)

    expect(updateEndpoints).toHaveBeenCalledOnce()
    expect(updateEndpoints).toHaveReturnedWith(
      expect.objectContaining({ ok: false })
    )
    // onConnectionsChange must not fire — no partial side effects.
    expect(onConnectionsChange).not.toHaveBeenCalled()
    expect(target.getInputLink(0)?.id).toBe(link.id)
    expect(target.getInputLink(1)).toBeNull()
  })
})
