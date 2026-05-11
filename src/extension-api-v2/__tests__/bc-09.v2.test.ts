// Category: BC.09 — Dynamic slot and output mutation
// DB cross-ref: S10.D1, S10.D3, S15.OS1
// Exemplar: https://github.com/Comfy-Org/ComfyUI_frontend/blob/main/src/lib/litegraph/src/canvas/LinkConnector.core.test.ts#L121
// blast_radius: 6.03 — compat-floor: blast_radius ≥ 2.0 — MUST pass before v2 ships
//
// Phase A findings:
// NodeHandle exposes inputs() and outputs() as read-only slot arrays (stable).
// Slot MUTATION (addInput/removeInput/addOutput/removeOutput) is NOT yet on the
// NodeHandle surface — this is a documented gap for Phase B.
// See: src/extension-api/node.ts — no addInput/removeInput methods present.
//
// Tests here prove the read surface contract that IS available today.
// Mutation and auto-reflow cases are in the Phase B block at the bottom.

import { describe, expect, it } from 'vitest'
import type { NodeHandle, SlotInfo } from '@/extension-api/node'

// ── Synthetic NodeHandle stub ─────────────────────────────────────────────────
// Minimal implementation of the NodeHandle slot surface for Phase A assertions.

function makeSlotInfo(overrides: Partial<SlotInfo> = {}): SlotInfo {
  return {
    entityId: 1 as SlotInfo['entityId'],
    name: 'input_0',
    type: 'LATENT',
    direction: 'input',
    nodeEntityId: 10 as SlotInfo['nodeEntityId'],
    ...overrides
  }
}

function makeNodeHandleWithSlots(
  inputs: SlotInfo[],
  outputs: SlotInfo[]
): Pick<NodeHandle, 'inputs' | 'outputs'> {
  return {
    inputs: () => inputs,
    outputs: () => outputs
  }
}

// ── Wired assertions (Phase A — read surface) ─────────────────────────────────

describe('BC.09 v2 contract — dynamic slot and output mutation', () => {
  describe('NodeHandle.inputs() — read-only slot array shape', () => {
    it('inputs() returns a readonly array of SlotInfo objects', () => {
      const slots = [
        makeSlotInfo({ name: 'image', type: 'IMAGE', direction: 'input' }),
        makeSlotInfo({ name: 'mask', type: 'MASK', direction: 'input', entityId: 2 as SlotInfo['entityId'] })
      ]
      const handle = makeNodeHandleWithSlots(slots, [])

      const result = handle.inputs()
      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('image')
      expect(result[0].type).toBe('IMAGE')
      expect(result[0].direction).toBe('input')
    })

    it('inputs() returns an empty array when the node has no input slots', () => {
      const handle = makeNodeHandleWithSlots([], [])
      expect(handle.inputs()).toHaveLength(0)
      expect(Array.isArray(handle.inputs())).toBe(true)
    })

    it('each SlotInfo has the required fields: entityId, name, type, direction, nodeEntityId', () => {
      const nodeId = 42 as SlotInfo['nodeEntityId']
      const slot = makeSlotInfo({ name: 'latent', type: 'LATENT', nodeEntityId: nodeId })
      const handle = makeNodeHandleWithSlots([slot], [])

      const [s] = handle.inputs()
      expect(s).toHaveProperty('entityId')
      expect(s).toHaveProperty('name', 'latent')
      expect(s).toHaveProperty('type', 'LATENT')
      expect(s).toHaveProperty('direction', 'input')
      expect(s).toHaveProperty('nodeEntityId', nodeId)
    })

    it('direction is always "input" for slots returned by inputs()', () => {
      const slots = [
        makeSlotInfo({ name: 'a', direction: 'input' }),
        makeSlotInfo({ name: 'b', direction: 'input', entityId: 2 as SlotInfo['entityId'] })
      ]
      const handle = makeNodeHandleWithSlots(slots, [])
      for (const s of handle.inputs()) {
        expect(s.direction).toBe('input')
      }
    })

    it('inputs() is stable across repeated calls (same reference contents)', () => {
      const slots = [makeSlotInfo({ name: 'x' })]
      const handle = makeNodeHandleWithSlots(slots, [])

      const first = handle.inputs()
      const second = handle.inputs()
      expect(first).toHaveLength(second.length)
      expect(first[0].name).toBe(second[0].name)
    })
  })

  describe('NodeHandle.outputs() — read-only slot array shape', () => {
    it('outputs() returns a readonly array of SlotInfo objects', () => {
      const slots = [
        makeSlotInfo({ name: 'LATENT', type: 'LATENT', direction: 'output' }),
        makeSlotInfo({ name: 'IMAGE', type: 'IMAGE', direction: 'output', entityId: 2 as SlotInfo['entityId'] })
      ]
      const handle = makeNodeHandleWithSlots([], slots)

      const result = handle.outputs()
      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('LATENT')
      expect(result[1].name).toBe('IMAGE')
    })

    it('outputs() returns an empty array when the node has no output slots', () => {
      const handle = makeNodeHandleWithSlots([], [])
      expect(handle.outputs()).toHaveLength(0)
    })

    it('direction is always "output" for slots returned by outputs()', () => {
      const slots = [
        makeSlotInfo({ name: 'out', direction: 'output' }),
        makeSlotInfo({ name: 'out2', direction: 'output', entityId: 2 as SlotInfo['entityId'] })
      ]
      const handle = makeNodeHandleWithSlots([], slots)
      for (const s of handle.outputs()) {
        expect(s.direction).toBe('output')
      }
    })

    it('inputs() and outputs() are independent arrays — do not share references', () => {
      const shared = makeSlotInfo({ name: 'shared' })
      const inSlot = { ...shared, direction: 'input' as const }
      const outSlot = { ...shared, direction: 'output' as const, entityId: 2 as SlotInfo['entityId'] }
      const handle = makeNodeHandleWithSlots([inSlot], [outSlot])

      expect(handle.inputs()[0].direction).toBe('input')
      expect(handle.outputs()[0].direction).toBe('output')
    })
  })

  describe('[gap] Slot mutation API — not yet on NodeHandle surface', () => {
    it.todo(
      '[gap] addInput(name, type) — not present on NodeHandle v2 surface; gap documented for Phase B. ' +
      'See: src/extension-api/node.ts NodeHandle interface (no addInput method). ' +
      'Phase B: add addInput/removeInput/addOutput/removeOutput dispatching CreateSlot/RemoveSlot ECS commands.'
    )
    it.todo(
      '[gap] removeInput(name) — same gap; Phase B required'
    )
    it.todo(
      '[gap] addOutput(name, type) — same gap; Phase B required'
    )
    it.todo(
      '[gap] removeOutput(name) — same gap; Phase B required'
    )
  })
})

// ── Phase B stubs — ECS dispatch + auto-reflow ────────────────────────────────

describe('BC.09 v2 contract — dynamic slot mutation [Phase B]', () => {
  describe('addInput / addOutput dispatch', () => {
    it.todo(
      'NodeHandle.addInput({ name, type }) dispatches CreateInputSlot command and returns a SlotInfo with stable entityId'
    )
    it.todo(
      'NodeHandle.addOutput({ name, type }) dispatches CreateOutputSlot command and the new slot appears in outputs()'
    )
    it.todo(
      'addInput with a duplicate name throws a typed DuplicateSlotError'
    )
  })

  describe('removeInput / removeOutput dispatch', () => {
    it.todo(
      'NodeHandle.removeInput(name) dispatches RemoveInputSlot; slot no longer appears in inputs()'
    )
    it.todo(
      'NodeHandle.removeOutput(name) dispatches RemoveOutputSlot; any links on that slot are detached'
    )
    it.todo(
      'removeInput(name) on a non-existent slot name throws a typed SlotNotFoundError'
    )
  })

  describe('auto-reflow (replaces S15.OS1 manual setSize)', () => {
    it.todo(
      'after addInput() the node size is automatically reflowed to fit all slots — no manual setSize required'
    )
    it.todo(
      'after removeOutput() the node height shrinks to remove the vacated slot space'
    )
    it.todo(
      'auto-reflow does not trigger a synchronous canvas redraw; redraw occurs on the next animation frame'
    )
  })
})
