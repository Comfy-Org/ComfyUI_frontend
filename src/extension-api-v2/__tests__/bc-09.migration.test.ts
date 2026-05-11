// Category: BC.09 — Dynamic slot and output mutation
// DB cross-ref: S10.D1, S10.D3, S15.OS1
// Exemplar: https://github.com/Comfy-Org/ComfyUI_frontend/blob/main/src/lib/litegraph/src/canvas/LinkConnector.core.test.ts#L121
// Migration: v1 positional addInput/removeInput/addOutput/removeOutput + manual setSize
//            → v2 NodeHandle slot mutation API (not yet on surface — see gap below)
//
// Phase A findings:
// NodeHandle has inputs()/outputs() (read-only). Slot mutation methods
// (addInput/removeInput/addOutput/removeOutput) are NOT on NodeHandle yet.
// This file tests:
// (a) v1 LGraphNode-style slot mutation shape (documenting the pattern)
// (b) v2 read-surface parity for existing slots
// (c) gap documentation for mutation equivalence (Phase B)
//
// I-TF.8.C2 — BC.09 migration wired assertions.

import { describe, expect, it } from 'vitest'
import type { SlotInfo, NodeEntityId, SlotEntityId } from '@/extension-api/node'

// ── V1 LGraphNode slot shim ───────────────────────────────────────────────────
// Models the v1 pattern: node.addInput(name, type) appends to node.inputs array;
// node.addOutput(name, type) appends to node.outputs array.
// setSize([w, h]) is manual after slot mutation.

interface V1Slot { name: string; type: string }

function createV1Node(type = 'TestNode') {
  const inputs: V1Slot[] = []
  const outputs: V1Slot[] = []
  let size: [number, number] = [200, 100]
  const BASE_ROW_HEIGHT = 24

  return {
    type,
    get inputs() { return inputs },
    get outputs() { return outputs },
    get size() { return size },
    addInput(name: string, slotType: string) { inputs.push({ name, type: slotType }) },
    addOutput(name: string, slotType: string) { outputs.push({ name, type: slotType }) },
    removeInput(index: number) { inputs.splice(index, 1) },
    removeOutput(index: number) { outputs.splice(index, 1) },
    setSize(s: [number, number]) { size = s },
    computeSize(): [number, number] {
      const rows = Math.max(inputs.length, outputs.length)
      return [200, Math.max(100, rows * BASE_ROW_HEIGHT + 40)]
    }
  }
}

// ── V2 read surface shim ──────────────────────────────────────────────────────
// Minimal model of the part of NodeHandle that exists today: inputs()/outputs().
// Mutation is a gap — see Phase B stubs.

function makeSlotInfo(name: string, type: string, direction: 'input' | 'output'): SlotInfo {
  return {
    entityId: (Math.random() * 1e9 | 0) as unknown as SlotEntityId,
    name,
    type,
    direction,
    nodeEntityId: 1 as unknown as NodeEntityId
  }
}

function createV2ReadSurface(initialInputs: SlotInfo[], initialOutputs: SlotInfo[]) {
  const inputs = [...initialInputs]
  const outputs = [...initialOutputs]
  return {
    inputs: () => inputs as readonly SlotInfo[],
    outputs: () => outputs as readonly SlotInfo[]
  }
}

// ── Wired migration tests (Phase A — read surface) ────────────────────────────

describe('BC.09 migration — dynamic slot and output mutation', () => {
  describe('v1 slot mutation shape documentation (S10.D1)', () => {
    it('v1 node.addInput(name, type) appends a slot at the end of node.inputs', () => {
      const node = createV1Node()
      expect(node.inputs).toHaveLength(0)

      node.addInput('image', 'IMAGE')
      node.addInput('mask', 'MASK')

      expect(node.inputs).toHaveLength(2)
      expect(node.inputs[0]).toEqual({ name: 'image', type: 'IMAGE' })
      expect(node.inputs[1]).toEqual({ name: 'mask', type: 'MASK' })
    })

    it('v1 node.addOutput(name, type) appends a slot at the end of node.outputs (S10.D3)', () => {
      const node = createV1Node()
      node.addOutput('LATENT', 'LATENT')
      node.addOutput('IMAGE', 'IMAGE')

      expect(node.outputs).toHaveLength(2)
      expect(node.outputs[0].name).toBe('LATENT')
      expect(node.outputs[1].name).toBe('IMAGE')
    })

    it('v1 removeInput(index) splices by position — order matters', () => {
      const node = createV1Node()
      node.addInput('a', 'IMAGE')
      node.addInput('b', 'LATENT')
      node.addInput('c', 'MASK')

      node.removeInput(1) // remove 'b' by position

      expect(node.inputs).toHaveLength(2)
      expect(node.inputs[0].name).toBe('a')
      expect(node.inputs[1].name).toBe('c')
    })

    it('v1 requires manual setSize after addInput to avoid slot overlap', () => {
      const node = createV1Node()
      const initialSize = node.size[1]

      node.addInput('extra', 'IMAGE')
      // Without setSize, height is unchanged — this is the v1 footgun
      expect(node.size[1]).toBe(initialSize)

      // Manual fix: call computeSize + setSize
      node.setSize(node.computeSize())
      expect(node.size[1]).toBeGreaterThanOrEqual(initialSize)
    })
  })

  describe('v2 read surface parity — inputs() / outputs() shape', () => {
    it('v2 inputs() returns the same count as v1 node.inputs after equivalent setup', () => {
      // v1 path
      const v1 = createV1Node()
      v1.addInput('image', 'IMAGE')
      v1.addInput('mask', 'MASK')

      // v2 path: pre-populated (mutation API gap — see Phase B)
      const v2 = createV2ReadSurface(
        [
          makeSlotInfo('image', 'IMAGE', 'input'),
          makeSlotInfo('mask', 'MASK', 'input')
        ],
        []
      )

      expect(v2.inputs()).toHaveLength(v1.inputs.length)
      expect(v2.inputs()).toHaveLength(2)
    })

    it('v2 outputs() returns the same count as v1 node.outputs after equivalent setup', () => {
      const v1 = createV1Node()
      v1.addOutput('LATENT', 'LATENT')

      const v2 = createV2ReadSurface([], [
        makeSlotInfo('LATENT', 'LATENT', 'output')
      ])

      expect(v2.outputs()).toHaveLength(v1.outputs.length)
    })

    it('v2 SlotInfo direction field distinguishes inputs from outputs (v1 relies on array membership)', () => {
      const v2 = createV2ReadSurface(
        [makeSlotInfo('image', 'IMAGE', 'input')],
        [makeSlotInfo('LATENT', 'LATENT', 'output')]
      )

      const allInputs = v2.inputs()
      const allOutputs = v2.outputs()

      for (const s of allInputs) expect(s.direction).toBe('input')
      for (const s of allOutputs) expect(s.direction).toBe('output')
    })

    it('v2 SlotInfo.name is stable identity (v1 used positional index — fragile)', () => {
      const v2 = createV2ReadSurface(
        [
          makeSlotInfo('image', 'IMAGE', 'input'),
          makeSlotInfo('mask', 'MASK', 'input')
        ],
        []
      )

      // Name-based access is safe even if order changes in future
      const byName = (name: string) => v2.inputs().find((s) => s.name === name)
      expect(byName('image')?.type).toBe('IMAGE')
      expect(byName('mask')?.type).toBe('MASK')
    })
  })

  describe('[gap] Slot mutation migration — Phase B required', () => {
    it.todo(
      '[gap] v2 NodeHandle.addInput({ name, type }) equivalent to v1 node.addInput(name, type) — ' +
      'addInput/removeInput not yet on NodeHandle surface (src/extension-api/node.ts). Phase B gap.'
    )
    it.todo(
      '[gap] v2 NodeHandle.removeInput(name) equivalent to v1 node.removeInput(index) — name-based vs positional. Phase B gap.'
    )
    it.todo(
      '[gap] v2 addOutput / removeOutput equivalents. Phase B gap.'
    )
    it.todo(
      '[gap] v2 auto-reflow eliminates the need for v1 setSize(computeSize()) after slot mutation. Phase B gap.'
    )
  })
})
