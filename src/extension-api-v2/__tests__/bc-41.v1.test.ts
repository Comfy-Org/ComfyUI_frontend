// Category: BC.41 — Widget values positional serialization fragility
// DB cross-ref: S17.WV1
// Exemplar: https://github.com/Comfy-Org/ComfyUI_frontend/blob/main/src/utils/nodeDefOrderingUtil.ts
// blast_radius: 3.45
// compat-floor: blast_radius ≥ 2.0
// v1 contract: node.widgets_values = [v1, v2, v3] positional array;
//              deserialization uses input_order alignment (only works when input_order defined)
// Note: Blocked on workflow-schema-migration. PR #10392 added widgets_values_named opt-in;
//       PR #11884 null guard.

import { describe, expect, it } from 'vitest'

// Synthetic node-def input list (matches v1 positional serialization model)
interface NodeInput {
  name: string
  type: string
  required: boolean
}

// Serialize widget values positionally from a node with given inputs
function serializeWidgetValues(
  inputs: NodeInput[],
  values: Record<string, unknown>,
): unknown[] {
  return inputs.map((inp) => values[inp.name] ?? null)
}

// Deserialize widget values positionally back to a Record
function deserializeWidgetValues(
  inputs: NodeInput[],
  widgetsValues: unknown[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  inputs.forEach((inp, i) => {
    result[inp.name] = widgetsValues[i] ?? null
  })
  return result
}

describe('BC.41 v1 contract — widget values positional serialization fragility', () => {
  describe('S17.WV1 — positional array serialization', () => {
    it('node.widgets_values serializes as a positional array aligned to input order', () => {
      const inputs: NodeInput[] = [
        { name: 'seed', type: 'INT', required: true },
        { name: 'steps', type: 'INT', required: true },
        { name: 'cfg', type: 'FLOAT', required: true },
      ]
      const values = { seed: 42, steps: 20, cfg: 7.0 }

      const serialized = serializeWidgetValues(inputs, values)
      expect(serialized).toEqual([42, 20, 7.0])
    })

    it('deserialization assigns values by position using input_order alignment', () => {
      const inputs: NodeInput[] = [
        { name: 'seed', type: 'INT', required: true },
        { name: 'steps', type: 'INT', required: true },
        { name: 'cfg', type: 'FLOAT', required: true },
      ]
      const widgetsValues = [42, 20, 7.0]

      const result = deserializeWidgetValues(inputs, widgetsValues)
      expect(result.seed).toBe(42)
      expect(result.steps).toBe(20)
      expect(result.cfg).toBe(7.0)
    })

    it('deserialization silently misaligns values when a new input is inserted before an existing input', () => {
      // Original definition: [seed, steps, cfg]
      // Saved widgets_values: [42, 20, 7.0]
      const savedValues = [42, 20, 7.0]

      // New definition: [new_input, seed, steps, cfg] — new_input inserted at position 0
      const newInputs: NodeInput[] = [
        { name: 'new_input', type: 'STRING', required: true }, // inserted!
        { name: 'seed', type: 'INT', required: true },
        { name: 'steps', type: 'INT', required: true },
        { name: 'cfg', type: 'FLOAT', required: true },
      ]

      const result = deserializeWidgetValues(newInputs, savedValues)
      // seed gets 42 → but it's mapped to new_input (position 0), seed gets 20
      expect(result.new_input).toBe(42) // wrong! 42 is the seed value
      expect(result.seed).toBe(20)      // wrong! 20 is steps
      expect(result.cfg).toBeNull()     // missing — array too short
    })
  })

  describe('S17.WV1 — silent failure modes', () => {
    it('adding a new required input at position 0 shifts all subsequent widget values by one', () => {
      const original = [100, 30, 8.0] // [seed=100, steps=30, cfg=8.0]

      // After inserting at position 0, positional alignment breaks
      const newInputs: NodeInput[] = [
        { name: 'sampler', type: 'COMBO', required: true }, // NEW at 0
        { name: 'seed', type: 'INT', required: true },
        { name: 'steps', type: 'INT', required: true },
        { name: 'cfg', type: 'FLOAT', required: true },
      ]

      const result = deserializeWidgetValues(newInputs, original)
      // sampler gets 100 (the seed value), seed gets 30 (the steps value), cfg is null
      expect(result.sampler).toBe(100)
      expect(result.seed).toBe(30)
      expect(result.cfg).toBeNull()
    })

    it('removing an input from the middle causes trailing widget values to map to wrong inputs', () => {
      const original = [42, 20, 7.0] // [seed=42, steps=20, cfg=7.0]

      // steps is removed from the definition
      const newInputs: NodeInput[] = [
        { name: 'seed', type: 'INT', required: true },
        { name: 'cfg', type: 'FLOAT', required: true }, // now at index 1
      ]

      const result = deserializeWidgetValues(newInputs, original)
      expect(result.seed).toBe(42) // correct
      expect(result.cfg).toBe(20)  // wrong! cfg gets the steps value (20) not cfg value (7.0)
    })

    it('round-trip is lossless only when the input definition is identical at save and load time', () => {
      const inputs: NodeInput[] = [
        { name: 'seed', type: 'INT', required: true },
        { name: 'steps', type: 'INT', required: true },
      ]
      const original = { seed: 999, steps: 15 }

      const serialized = serializeWidgetValues(inputs, original)
      const restored = deserializeWidgetValues(inputs, serialized)

      // Identical definition → perfect round-trip
      expect(restored.seed).toBe(999)
      expect(restored.steps).toBe(15)
    })
  })
})
