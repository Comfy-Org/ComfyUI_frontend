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

import { describe, expect, it, vi } from 'vitest'
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
      expect(found, 'Expected at least one S2.N15 excerpt with onSerialize fingerprint').toBe(true)
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
        return { id: this.id, type: this.type, widgets_values: this.widgets_values }
      }
      const NodeProto: { serialize: (this: MockNode) => Record<string, unknown> } = {
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
        return { id: this.id, type: this.type, widgets_values: this.widgets_values }
      }
      const NodeProto: { serialize: (this: MockNode) => Record<string, unknown> } = {
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

    it.todo(
      'positional widgets_values in the patched serialize output drifts when a serialize===false widget occupies a slot before the target widget'
    )
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

    it.todo(
      'positional drift with serialize===false widgets: NaN values written inside onSerialize are silently coerced to null by JSON.stringify'
    )
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
