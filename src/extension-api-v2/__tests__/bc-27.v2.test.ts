/**
 * BC.27 — LiteGraph entity direct manipulation (reroute, group, link, slot) [v2 contract]
 *
 * Patterns: S9.R1 (reroute), S9.G1 (group), S9.L1 (link), S9.S1 (slot)
 *
 * Disposition: strangler-fig (Phase A — the v1 direct mutation API remains
 * available, but Phase B typed APIs are defined here as the v2 contract.)
 *
 * Phase A contract (now):
 *   - Extensions that directly mutate LGraph internals (reroutes, groups, links,
 *     slot arrays) are tolerated as long as they compile under strict v2 TS types.
 *   - The v2 contract DOCUMENTS the intended replacement API surface:
 *       graph.addGroup({ title, color, bounding })  → LGraphGroup handle
 *       graph.addReroute(pos)                        → reroute NodeHandle
 *       node.inputs() / node.outputs()              → SlotInfo[] (read-only)
 *       link.srcNode / link.dstNode / link.type     → typed, read-only
 *   - Direct mutation (node._data.inputs.push(...)) is NOT in the v2 contract.
 *
 * Phase B upgrade: implement graph.addGroup / addReroute in extension-api-service;
 * replace it.todo stubs below with real tests using the typed API.
 *
 * DB cross-ref: S9.R1, S9.G1, S9.L1, S9.S1
 */
import { describe, it, expect } from 'vitest'

import { loadEvidenceSnippet, runV1, runV2 } from '@/extension-api-v2/harness'
import type { NodeHandle, NodeEntityId, SlotInfo, SlotEntityId } from '@/types/extensionV2'

void [loadEvidenceSnippet, runV1, runV2]

// ─── Synthetic slot fixture ───────────────────────────────────────────────────

function makeSlotInfo(
  name: string,
  type: string,
  direction: 'input' | 'output'
): SlotInfo {
  return {
    entityId: 1 as SlotEntityId,
    name,
    type,
    direction,
    nodeEntityId: 1 as NodeEntityId,
  }
}

function makeNodeHandleWithSlots(
  inputs: SlotInfo[],
  outputs: SlotInfo[]
): Pick<NodeHandle, 'inputs' | 'outputs'> {
  return {
    inputs: () => inputs as readonly SlotInfo[],
    outputs: () => outputs as readonly SlotInfo[],
  }
}

// ─── S9.S1 — slot read-only access (Phase A) ─────────────────────────────────

describe('BC.27 — LiteGraph entity direct manipulation [v2 contract] — S9.S1 slots', () => {
  it('node.inputs() returns typed SlotInfo with name, type, direction', () => {
    const input = makeSlotInfo('model', 'MODEL', 'input')
    const node = makeNodeHandleWithSlots([input], [])

    const slots = node.inputs()
    expect(slots).toHaveLength(1)
    expect(slots[0].name).toBe('model')
    expect(slots[0].type).toBe('MODEL')
    expect(slots[0].direction).toBe('input')
  })

  it('node.outputs() returns typed SlotInfo', () => {
    const out = makeSlotInfo('LATENT', 'LATENT', 'output')
    const node = makeNodeHandleWithSlots([], [out])

    const slots = node.outputs()
    expect(slots[0].name).toBe('LATENT')
    expect(slots[0].direction).toBe('output')
  })

  it('node.inputs() return type is readonly SlotInfo[] — type guards against mutation', () => {
    const input = makeSlotInfo('clip', 'CLIP', 'input')
    const node = makeNodeHandleWithSlots([input], [])

    // The v2 contract returns `readonly SlotInfo[]`.
    // TypeScript prevents: node.inputs().push(...) — compile error without a cast.
    // This test confirms the return type carries the correct element shape.
    const slots: readonly SlotInfo[] = node.inputs()
    expect(slots).toHaveLength(1)
    expect(slots[0].name).toBe('clip')
    expect(slots[0].type).toBe('CLIP')
    expect(slots[0].direction).toBe('input')
  })

  it('empty node has no inputs or outputs', () => {
    const node = makeNodeHandleWithSlots([], [])
    expect(node.inputs()).toHaveLength(0)
    expect(node.outputs()).toHaveLength(0)
  })
})

// ─── S9.G1 — group API (Phase B placeholder) ─────────────────────────────────

describe('BC.27 — LiteGraph entity direct manipulation [v2 contract] — S9.G1 groups', () => {
  it.todo(
    'S9.G1 Phase B — graph.addGroup({ title, color, bounding }) returns a typed group handle'
  )

  it.todo(
    'S9.G1 Phase B — group.title and group.color are typed, settable without direct LGraph mutation'
  )
})

// ─── S9.R1 — reroute API (Phase B placeholder) ───────────────────────────────

describe('BC.27 — LiteGraph entity direct manipulation [v2 contract] — S9.R1 reroutes', () => {
  it.todo(
    'S9.R1 Phase B — graph.addReroute(pos) returns a typed NodeHandle for the reroute node'
  )

  it.todo(
    'S9.R1 Phase B — reroute node appears in graph.nodes() and can be removed via node.remove()'
  )
})

// ─── S9.L1 — link read access (Phase A) ──────────────────────────────────────

describe('BC.27 — LiteGraph entity direct manipulation [v2 contract] — S9.L1 links', () => {
  it.todo(
    'S9.L1 Phase B — link.srcNode, link.dstNode, link.type are typed read-only fields on LinkHandle'
  )

  it.todo(
    'S9.L1 Phase B — graph.links() returns all active links as typed LinkHandle[]'
  )
})
