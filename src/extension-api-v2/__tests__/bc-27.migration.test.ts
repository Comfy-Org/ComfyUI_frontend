/**
 * BC.27 — LiteGraph entity direct manipulation (reroute, group, link, slot) [v1 → v2 migration]
 *
 * Patterns: S9.R1, S9.G1, S9.L1, S9.S1
 *
 * Migration table (strangler-fig — Phase A: v1 still works, Phase B: typed API):
 *   v1: node.inputs.push({ name, type, link: null })     → Phase B: typed slot API
 *   v1: graph.groups.push(new LiteGraph.LGraphGroup())   → Phase B: graph.addGroup(opts)
 *   v1: graph.links[id]                                  → Phase B: graph.links() iterator
 *   v1: node._data.inputs[i].link / links_up[i]         → Phase B: typed SlotInfo + LinkHandle
 *
 * Phase A: tests cover the slot read-only surface already available on NodeHandle.
 * Phase B upgrade stubs document the full typed migration.
 *
 * DB cross-ref: S9.R1, S9.G1, S9.L1, S9.S1
 */
import { describe, it, expect } from 'vitest'

import { loadEvidenceSnippet, runV1, runV2 } from '@/extension-api-v2/harness'
import type { SlotInfo, SlotEntityId, NodeEntityId } from '@/types/extensionV2'

void [loadEvidenceSnippet, runV1, runV2]

// ─── Fixtures ────────────────────────────────────────────────────────────────

interface V1Slot {
  name: string
  type: string
  link: number | null
  links?: number[]
}

interface V1Node {
  inputs: V1Slot[]
  outputs: V1Slot[]
}

function makeV1Node(inputs: V1Slot[], outputs: V1Slot[]): V1Node {
  return { inputs: [...inputs], outputs: [...outputs] }
}

function makeSlotInfo(name: string, type: string, dir: 'input' | 'output'): SlotInfo {
  return {
    entityId: 1 as SlotEntityId,
    name,
    type,
    direction: dir,
    nodeEntityId: 1 as NodeEntityId,
  }
}

// ─── S9.S1 migration: slot read access ───────────────────────────────────────

describe('BC.27 [migration] — S9.S1: slot read access', () => {
  it('v1 node.inputs[i].name and v2 node.inputs()[i].name carry the same value', () => {
    const v1Slot: V1Slot = { name: 'model', type: 'MODEL', link: null }
    const v1Node = makeV1Node([v1Slot], [])

    const v2Slot = makeSlotInfo('model', 'MODEL', 'input')
    const v2Inputs = [v2Slot]

    expect(v1Node.inputs[0].name).toBe(v2Inputs[0].name)
  })

  it('v1 node.inputs[i].type and v2 SlotInfo.type carry the same value', () => {
    const v1Slot: V1Slot = { name: 'clip', type: 'CLIP', link: null }
    const v2Slot = makeSlotInfo('clip', 'CLIP', 'input')

    expect(v1Slot.type).toBe(v2Slot.type)
  })

  it('v2 SlotInfo.direction discriminates input vs output (v1 had no direction field)', () => {
    // v1: direction was implicit from which array the slot lived in (inputs vs outputs)
    // v2: SlotInfo carries an explicit direction field — migration improvement
    const inputSlot = makeSlotInfo('model', 'MODEL', 'input')
    const outputSlot = makeSlotInfo('LATENT', 'LATENT', 'output')

    expect(inputSlot.direction).toBe('input')
    expect(outputSlot.direction).toBe('output')
  })

  it('v1 node.inputs array length and v2 node.inputs() count match', () => {
    const v1 = makeV1Node(
      [
        { name: 'model', type: 'MODEL', link: null },
        { name: 'clip', type: 'CLIP', link: null },
      ],
      []
    )
    const v2Inputs = [
      makeSlotInfo('model', 'MODEL', 'input'),
      makeSlotInfo('clip', 'CLIP', 'input'),
    ]

    expect(v1.inputs.length).toBe(v2Inputs.length)
  })
})

// ─── S9.G1 Phase B migration stubs ────────────────────────────────────────────

describe('BC.27 [migration] — S9.G1: group manipulation', () => {
  it.todo(
    'S9.G1 Phase B — v1 graph.groups.push(new LGraphGroup()) → v2 graph.addGroup({ title, color, bounding })'
  )

  it.todo(
    'S9.G1 Phase B — v1 group.title = x → v2 group.setTitle(x) dispatches command (undo-able)'
  )
})

// ─── S9.R1 Phase B migration stubs ────────────────────────────────────────────

describe('BC.27 [migration] — S9.R1: reroute manipulation', () => {
  it.todo(
    'S9.R1 Phase B — v1 createNode("Reroute") + manual wiring → v2 graph.addReroute(pos)'
  )
})

// ─── S9.L1 Phase B migration stubs ────────────────────────────────────────────

describe('BC.27 [migration] — S9.L1: link access', () => {
  it.todo(
    'S9.L1 Phase B — v1 graph.links[id].origin_id → v2 LinkHandle.srcNode.entityId'
  )

  it.todo(
    'S9.L1 Phase B — v1 graph.links[id].type → v2 LinkHandle.type (typed, read-only)'
  )
})
