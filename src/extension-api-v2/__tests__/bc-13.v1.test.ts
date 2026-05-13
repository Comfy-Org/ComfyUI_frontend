// Category: BC.13 — Per-node serialization interception
// DB cross-ref: S2.N6, S2.N15
// Exemplar: https://github.com/Azornes/Comfyui-LayerForge/blob/main/js/CanvasView.js#L1438
// blast_radius: 6.36 — compat-floor: blast_radius ≥ 2.0 — MUST pass before v2 ships
// v1 contract: node.prototype.serialize = function() { const r = origSerialize.call(this); r.myData = ...; return r }
//              node.onSerialize = function(data) { data.myData = ... }
// Notes: widgets_values is positional. Three index-drift sources: control_after_generate slot occupancy,
//        extension-injected widgets, V3 IO.MultiType topology-dependent widget count. NaN→null pipeline
//        produces silent corruption. Test (a) positional v1 compat, (b) named-map v2 round-trip parity,
//        (c) null-in-numeric-widget logs warning + substitutes default.

import { describe, expect, it } from 'vitest'
import {
  countEvidenceExcerpts,
  createMiniComfyApp,
  loadEvidenceSnippet,
  runV1
} from '../harness'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BC.13 v1 contract — per-node serialization interception', () => {
  // ── S2.N6 evidence ───────────────────────────────────────────────────────────
  describe('S2.N6 — evidence excerpts', () => {
    it('S2.N6 has at least one evidence excerpt', () => {
      expect(countEvidenceExcerpts('S2.N6')).toBeGreaterThan(0)
    })

    it('S2.N6 evidence snippet contains serialize fingerprint', () => {
      const snippet = loadEvidenceSnippet('S2.N6', 0)
      expect(snippet).toMatch(/serialize/i)
    })

    it('S2.N6 snippet is capturable by runV1 without throwing', () => {
      const snippet = loadEvidenceSnippet('S2.N6', 0)
      const app = createMiniComfyApp()
      expect(() => runV1(snippet, { app })).not.toThrow()
    })
  })

  // ── S2.N15 evidence ──────────────────────────────────────────────────────────
  describe('S2.N15 — evidence excerpts', () => {
    it('S2.N15 has at least one evidence excerpt', () => {
      expect(countEvidenceExcerpts('S2.N15')).toBeGreaterThan(0)
    })

    it('S2.N15 evidence snippet contains onSerialize fingerprint', () => {
      const count = countEvidenceExcerpts('S2.N15')
      let found = false
      for (let i = 0; i < count; i++) {
        const snippet = loadEvidenceSnippet('S2.N15', i)
        if (/onSerialize|serialize/i.test(snippet)) {
          found = true
          break
        }
      }
      expect(
        found,
        'Expected at least one S2.N15 excerpt with onSerialize fingerprint'
      ).toBe(true)
    })

    it('S2.N15 snippet is capturable by runV1 without throwing', () => {
      const snippet = loadEvidenceSnippet('S2.N15', 0)
      const app = createMiniComfyApp()
      expect(() => runV1(snippet, { app })).not.toThrow()
    })
  })

  // ── S2.N6 synthetic behavior ─────────────────────────────────────────────────
  describe('S2.N6 — prototype.serialize patching', () => {
    it('patching prototype.serialize and chaining origSerialize includes base fields plus custom fields', () => {
      interface MockNode {
        id: number
        type: string
        widgets_values: unknown[]
        serialize(): Record<string, unknown>
      }
      const baseSerialize = function (this: MockNode) {
        return {
          id: this.id,
          type: this.type,
          widgets_values: this.widgets_values
        }
      }
      const NodeProto: {
        serialize: (this: MockNode) => Record<string, unknown>
      } = {
        serialize: baseSerialize
      }
      // Extension patches
      const origSerialize = NodeProto.serialize
      NodeProto.serialize = function (this: MockNode) {
        const r = origSerialize.call(this)
        r.myData = 'hello'
        return r
      }
      const node = Object.assign(Object.create(NodeProto) as MockNode, {
        id: 1,
        type: 'KSampler',
        widgets_values: [42]
      })
      const result = node.serialize()
      expect(result.myData).toBe('hello')
      expect(result.id).toBe(1)
      expect(result.type).toBe('KSampler')
      expect(result.widgets_values).toEqual([42])
    })

    it('multiple extensions chaining each contribute their custom fields', () => {
      interface MockNode {
        id: number
        type: string
        widgets_values: unknown[]
        serialize(): Record<string, unknown>
      }
      const baseSerialize = function (this: MockNode) {
        return {
          id: this.id,
          type: this.type,
          widgets_values: this.widgets_values
        }
      }
      const NodeProto: {
        serialize: (this: MockNode) => Record<string, unknown>
      } = {
        serialize: baseSerialize
      }

      // Extension A patches first
      const orig1 = NodeProto.serialize
      NodeProto.serialize = function (this: MockNode) {
        const r = orig1.call(this)
        r.extensionA = 'data-from-A'
        return r
      }
      // Extension B patches second
      const orig2 = NodeProto.serialize
      NodeProto.serialize = function (this: MockNode) {
        const r = orig2.call(this)
        r.extensionB = 'data-from-B'
        return r
      }

      const node = Object.assign(Object.create(NodeProto) as MockNode, {
        id: 2,
        type: 'VAEDecode',
        widgets_values: []
      })
      const result = node.serialize()
      expect(result.extensionA).toBe('data-from-A')
      expect(result.extensionB).toBe('data-from-B')
      expect(result.id).toBe(2)
    })

    it('positional widgets_values in the patched serialize output drifts when a serialize===false widget occupies a slot before the target widget', () => {
      // Demonstrates how serialize===false widgets cause positional drift between
      // frontend serialization (all widgets) and backend prompt (only serializable widgets)
      interface MockWidget {
        name: string
        value: unknown
        options?: { serialize?: boolean }
      }
      interface MockNode {
        id: number
        type: string
        widgets: MockWidget[]
        serialize(): { id: number; type: string; widgets_values: unknown[] }
      }

      // Create a node with 3 widgets, middle one has serialize===false
      const node: MockNode = {
        id: 1,
        type: 'KSampler',
        widgets: [
          { name: 'steps', value: 20 },
          { name: 'control_after_generate', value: 'fixed', options: { serialize: false } },
          { name: 'cfg', value: 7.5 }
        ],
        serialize() {
          // v1 serialize includes ALL widgets positionally (including serialize===false)
          return {
            id: this.id,
            type: this.type,
            widgets_values: this.widgets.map((w) => w.value)
          }
        }
      }

      const serialized = node.serialize()

      // Frontend serialize output: all 3 widgets present
      expect(serialized.widgets_values).toEqual([20, 'fixed', 7.5])
      expect(serialized.widgets_values).toHaveLength(3)

      // Simulate what graphToPrompt sends to backend (excludes serialize===false)
      const backendWidgetsValues = node.widgets
        .filter((w) => w.options?.serialize !== false)
        .map((w) => w.value)

      // Backend sees only 2 widgets - positional drift!
      expect(backendWidgetsValues).toEqual([20, 7.5])
      expect(backendWidgetsValues).toHaveLength(2)

      // Drift: cfg is at index 2 in frontend, but index 1 in backend
      expect(serialized.widgets_values[2]).toBe(7.5) // frontend: cfg at index 2
      expect(backendWidgetsValues[1]).toBe(7.5) // backend: cfg at index 1
    })
  })

  // ── S2.N15 synthetic behavior ────────────────────────────────────────────────
  describe('S2.N15 — node.onSerialize callback', () => {
    it('onSerialize mutates data in place; mutation is reflected in result', () => {
      const data = { id: 1, widgets_values: [42] } as Record<string, unknown>
      const node = {
        onSerialize: (d: Record<string, unknown>) => {
          d.extra = 'injected'
        }
      }
      // Simulate LiteGraph calling onSerialize after base serialize
      node.onSerialize(data)
      expect(data.extra).toBe('injected')
    })

    it('onSerialize fires twice when serialized twice', () => {
      const calls: number[] = []
      const data1 = { id: 1, widgets_values: [] } as Record<string, unknown>
      const data2 = { id: 1, widgets_values: [] } as Record<string, unknown>
      const node = {
        onSerialize: (d: Record<string, unknown>) => {
          calls.push(calls.length)
          d.callIndex = calls.length
        }
      }
      node.onSerialize(data1)
      node.onSerialize(data2)
      expect(calls).toHaveLength(2)
      expect(data1.callIndex).toBe(1)
      expect(data2.callIndex).toBe(2)
    })

    it.todo(
      'real graphToPrompt integration: onSerialize fires once per graphToPrompt call in the real app'
    )

    it('positional drift with serialize===false widgets: NaN values written inside onSerialize are silently coerced to null by JSON.stringify', () => {
      // Demonstrates that NaN values injected via onSerialize become null after JSON round-trip
      // This is especially problematic with positional drift from serialize===false widgets
      interface MockWidget {
        name: string
        value: unknown
        options?: { serialize?: boolean }
      }
      const node = {
        widgets: [
          { name: 'steps', value: 20 },
          { name: 'control_after_generate', value: 'fixed', options: { serialize: false } },
          { name: 'denoise', value: 1.0 }
        ] as MockWidget[],
        onSerialize: (data: { widgets_values: unknown[] }) => {
          // Extension injects NaN via onSerialize (e.g., invalid computation result)
          data.widgets_values[2] = NaN
        }
      }

      // Simulate serialize + onSerialize flow
      const data = {
        id: 1,
        widgets_values: node.widgets.map((w) => w.value)
      }
      node.onSerialize(data)

      // Before JSON round-trip: NaN is present
      expect(Number.isNaN(data.widgets_values[2])).toBe(true)

      // JSON round-trip silently corrupts NaN to null
      const restored = JSON.parse(JSON.stringify(data)) as typeof data
      expect(restored.widgets_values[2]).toBeNull()

      // Combined with positional drift: if workflow is restored on a version
      // without the serialize===false widget, the null lands on wrong widget
      // Original: [steps=20, control='fixed', denoise=NaN→null]
      // Without control_after_generate: indices shift, null could corrupt 'steps'
    })
  })

  // ── NaN→null silent corruption ───────────────────────────────────────────────
  describe('NaN→null silent corruption', () => {
    it('JSON.stringify(NaN) === "null", and JSON.parse("null") === null — synthetic proof', () => {
      const widgets_values = [NaN]
      const serialized = JSON.stringify(widgets_values) // "[null]"
      const restored = JSON.parse(serialized) as unknown[]
      expect(restored[0]).toBeNull()
    })

    it('restored null is not equal to 0 and not equal to widget default', () => {
      const widgets_values = [NaN]
      const serialized = JSON.stringify(widgets_values)
      const restored = JSON.parse(serialized) as unknown[]
      const restoredValue = restored[0]
      const widgetDefault = 0
      expect(restoredValue).not.toBe(0)
      expect(restoredValue).not.toBe(widgetDefault)
      expect(restoredValue).toBeNull()
    })
  })
})
