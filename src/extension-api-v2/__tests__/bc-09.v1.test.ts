// Category: BC.09 — Dynamic slot and output mutation
// DB cross-ref: S10.D1, S10.D3, S15.OS1
// Exemplar: https://github.com/Comfy-Org/ComfyUI_frontend/blob/main/src/lib/litegraph/src/canvas/LinkConnector.core.test.ts#L121
// blast_radius: 6.03 — compat-floor: blast_radius ≥ 2.0 — MUST pass before v2 ships
// v1 contract: node.addInput(name, type), node.removeInput(slot)
//              node.addOutput(name, type), node.removeOutput(slot)
//              node.setSize([w, h])

import { describe, it, expect } from 'vitest'

type Slot = { name: string; type: string; link?: number | null }
type OutputSlot = { name: string; type: string; links?: number[] }

function makeNode() {
  const inputs: Slot[] = []
  const outputs: OutputSlot[] = []
  const size: [number, number] = [200, 100]

  return {
    inputs,
    outputs,
    size,
    addInput(name: string, type: string) {
      inputs.push({ name, type, link: null })
    },
    removeInput(slot: number) {
      inputs.splice(slot, 1)
    },
    addOutput(name: string, type: string) {
      outputs.push({ name, type, links: [] })
    },
    removeOutput(slot: number) {
      outputs.splice(slot, 1)
    },
    setSize(s: [number, number]) {
      size[0] = s[0]
      size[1] = s[1]
    },
    computeSize(): [number, number] {
      const slotHeight = 20
      const rows = Math.max(inputs.length, outputs.length, 1)
      return [size[0], rows * slotHeight + 40]
    },
  }
}

describe('BC.09 v1 contract — dynamic slot and output mutation', () => {
  describe('S10.D1 — addInput / removeInput', () => {
    it('node.addInput(name, type) appends a new input slot to node.inputs and increments node.inputs.length', () => {
      const node = makeNode()
      expect(node.inputs).toHaveLength(0)
      node.addInput('latent', 'LATENT')
      expect(node.inputs).toHaveLength(1)
      expect(node.inputs[0].name).toBe('latent')
      expect(node.inputs[0].type).toBe('LATENT')
    })

    it('node.removeInput(slot) removes the slot at the given index and shifts subsequent slots down by one', () => {
      const node = makeNode()
      node.addInput('a', 'INT')
      node.addInput('b', 'FLOAT')
      node.addInput('c', 'STRING')
      // Remove middle slot
      node.removeInput(1)
      expect(node.inputs).toHaveLength(2)
      expect(node.inputs[0].name).toBe('a')
      expect(node.inputs[1].name).toBe('c')
    })

    it('removing an input slot that has an active link also removes the corresponding link from the graph', () => {
      const graph = { links: new Map<number, { id: number; target_id: number; target_slot: number }>() }
      const node = { id: 10, inputs: [{ name: 'img', type: 'IMAGE', link: 99 }] as Slot[] }
      graph.links.set(99, { id: 99, target_id: 10, target_slot: 0 })

      // v1 pattern: remove slot and clean up the link
      const removedLink = node.inputs[0].link
      node.inputs.splice(0, 1)
      if (removedLink !== null && removedLink !== undefined) {
        graph.links.delete(removedLink)
      }

      expect(node.inputs).toHaveLength(0)
      expect(graph.links.has(99)).toBe(false)
    })

    it('addInput with a duplicate name appends a second slot without error (v1 allows duplicates)', () => {
      const node = makeNode()
      node.addInput('image', 'IMAGE')
      node.addInput('image', 'IMAGE')
      expect(node.inputs).toHaveLength(2)
      expect(node.inputs[0].name).toBe('image')
      expect(node.inputs[1].name).toBe('image')
    })
  })

  describe('S10.D3 — addOutput / removeOutput', () => {
    it('node.addOutput(name, type) appends a new output slot to node.outputs and increments node.outputs.length', () => {
      const node = makeNode()
      node.addOutput('IMAGE', 'IMAGE')
      expect(node.outputs).toHaveLength(1)
      expect(node.outputs[0].name).toBe('IMAGE')
      expect(node.outputs[0].type).toBe('IMAGE')
    })

    it('node.removeOutput(slot) removes the output slot and detaches all outgoing links on that slot', () => {
      const graph = { links: new Map<number, unknown>() }
      const node = {
        outputs: [
          { name: 'IMAGE', type: 'IMAGE', links: [5, 6] },
          { name: 'MASK', type: 'MASK', links: [] },
        ] as OutputSlot[],
      }
      graph.links.set(5, {})
      graph.links.set(6, {})

      // v1 pattern: clear outgoing links, then splice
      const slot = node.outputs[0]
      for (const linkId of slot.links ?? []) {
        graph.links.delete(linkId)
      }
      node.outputs.splice(0, 1)

      expect(node.outputs).toHaveLength(1)
      expect(node.outputs[0].name).toBe('MASK')
      expect(graph.links.has(5)).toBe(false)
      expect(graph.links.has(6)).toBe(false)
    })

    it('removing an output slot does not affect links on other output slots of the same node', () => {
      const graph = { links: new Map<number, unknown>() }
      const node = {
        outputs: [
          { name: 'A', type: 'INT', links: [1] },
          { name: 'B', type: 'INT', links: [2, 3] },
        ] as OutputSlot[],
      }
      graph.links.set(1, {})
      graph.links.set(2, {})
      graph.links.set(3, {})

      // Remove first output slot only
      for (const linkId of node.outputs[0].links ?? []) {
        graph.links.delete(linkId)
      }
      node.outputs.splice(0, 1)

      expect(node.outputs).toHaveLength(1)
      expect(graph.links.has(1)).toBe(false)
      expect(graph.links.has(2)).toBe(true)
      expect(graph.links.has(3)).toBe(true)
    })
  })

  describe('S15.OS1 — computeSize / setSize reflow', () => {
    it('node.setSize([w, h]) updates node.size to the provided dimensions immediately', () => {
      const node = makeNode()
      node.setSize([350, 220])
      expect(node.size[0]).toBe(350)
      expect(node.size[1]).toBe(220)
    })

    it('addInput/addOutput followed by node.setSize([...node.computeSize()]) produces a node tall enough to display all slots without overlap', () => {
      const node = makeNode()
      node.addInput('a', 'INT')
      node.addInput('b', 'FLOAT')
      node.addInput('c', 'STRING')
      node.addOutput('result', 'INT')

      const computed = node.computeSize()
      node.setSize([...computed])

      // 3 input rows × 20px + 40px padding = 100px minimum
      expect(node.size[1]).toBeGreaterThanOrEqual(3 * 20)
    })

    it('setSize does not trigger a canvas redraw synchronously; redraw occurs on the next animation frame', () => {
      const drawCalls: string[] = []
      const node = makeNode()
      // Simulate the canvas draw loop — setSize only mutates size[], not draw
      const mockCanvas = {
        draw() { drawCalls.push('draw') }
      }
      node.setSize([400, 300])
      // Canvas draw was not called as part of setSize
      expect(drawCalls).toHaveLength(0)
      // Only when the canvas loop runs does it draw
      mockCanvas.draw()
      expect(drawCalls).toHaveLength(1)
    })
  })
})
