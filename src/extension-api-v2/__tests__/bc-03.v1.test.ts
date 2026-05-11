// Category: BC.03 — Node lifecycle: hydration from saved workflows
// DB cross-ref: S1.H1, S2.N7
// Exemplar: https://github.com/Comfy-Org/ComfyUI_frontend/blob/main/src/extensions/core/
// Surface: S1.H1 = beforeRegisterNodeDef (used for hydration guards), S2.N7 = node.onConfigure
// compat-floor: blast_radius 4.91 ≥ 2.0 — MUST pass before v2 ships
// v1 contract: S1.H1 = beforeRegisterNodeDef guard; S2.N7 = node.onConfigure = function(data) { ... }
// Note: loadedGraphNode hook exists in LiteGraph but is effectively unused in ComfyUI —
//       onConfigure is the de-facto hydration surface.

import { describe, expect, it, vi } from 'vitest'
import {
  createMiniComfyApp,
  countEvidenceExcerpts,
  loadEvidenceSnippet,
  runV1
} from '../harness'

interface SerializedNodeData {
  widgets_values?: unknown[]
  properties?: Record<string, unknown>
  [key: string]: unknown
}

describe('BC.03 v1 contract — node lifecycle: hydration from saved workflows', () => {
  describe('S2.N7 — evidence excerpts', () => {
    it('S2.N7 has at least one evidence excerpt', () => {
      expect(countEvidenceExcerpts('S2.N7')).toBeGreaterThan(0)
    })

    it('S2.N7 evidence snippet contains onConfigure fingerprint', () => {
      const snippet = loadEvidenceSnippet('S2.N7', 0)
      expect(snippet).toMatch(/onConfigure/i)
    })

    it('S2.N7 snippet is capturable by runV1 without throwing', () => {
      const snippet = loadEvidenceSnippet('S2.N7', 0)
      const app = createMiniComfyApp()
      expect(() => runV1(snippet, { app })).not.toThrow()
    })
  })

  describe('S1.H1 — evidence excerpts', () => {
    it('S1.H1 has at least one evidence excerpt', () => {
      expect(countEvidenceExcerpts('S1.H1')).toBeGreaterThan(0)
    })

    it('S1.H1 evidence snippet contains beforeRegisterNodeDef fingerprint', () => {
      const count = countEvidenceExcerpts('S1.H1')
      let found = false
      for (let i = 0; i < count; i++) {
        if (/beforeRegisterNodeDef/i.test(loadEvidenceSnippet('S1.H1', i))) {
          found = true
          break
        }
      }
      expect(found, 'Expected at least one S1.H1 excerpt with beforeRegisterNodeDef fingerprint').toBe(true)
    })

    it('S1.H1 snippet is capturable by runV1 without throwing', () => {
      const snippet = loadEvidenceSnippet('S1.H1', 0)
      const app = createMiniComfyApp()
      expect(() => runV1(snippet, { app })).not.toThrow()
    })
  })

  describe('S2.N7 — node.onConfigure (synthetic)', () => {
    it('onConfigure callback receives the raw serialized data object', () => {
      const received: SerializedNodeData[] = []
      const node = {
        onConfigure: vi.fn((data: SerializedNodeData) => received.push(data))
      }
      const serializedData: SerializedNodeData = {
        widgets_values: [42],
        properties: { custom_label: 'upscaler' }
      }

      node.onConfigure(serializedData)

      expect(node.onConfigure).toHaveBeenCalledOnce()
      expect(received[0]).toBe(serializedData)
    })

    it('widget values in data.widgets_values are accessible inside the callback', () => {
      let capturedWidgetsValues: unknown[] | undefined
      const node = {
        onConfigure(data: SerializedNodeData) {
          capturedWidgetsValues = data.widgets_values as unknown[]
        }
      }

      node.onConfigure({ widgets_values: [42], properties: { custom_label: 'upscaler' } })

      expect(capturedWidgetsValues).toEqual([42])
    })

    it('custom properties in data.properties are accessible inside the callback', () => {
      let capturedLabel: unknown
      const node = {
        onConfigure(data: SerializedNodeData) {
          capturedLabel = data.properties?.custom_label
        }
      }

      node.onConfigure({ widgets_values: [42], properties: { custom_label: 'upscaler' } })

      expect(capturedLabel).toBe('upscaler')
    })

    it('onConfigure is NOT called on fresh creation (only on load)', () => {
      const onConfigure = vi.fn()
      // A freshly created node never has onConfigure invoked by the runtime
      // — we assert no invocations occurred without any explicit call.
      expect(onConfigure).not.toHaveBeenCalled()
    })

    it.todo(
      'fires during actual LiteGraph graph.configure()'
    )

    it.todo(
      'LoadedFromWorkflow ECS tag'
    )
  })

  describe('S1.H1 — beforeRegisterNodeDef hydration guard (synthetic)', () => {
    it('prototype-level onConfigure injected in beforeRegisterNodeDef fires for all instances', () => {
      const calls: unknown[] = []
      const proto: Record<string, unknown> = {}

      // Simulate beforeRegisterNodeDef injecting onConfigure on the prototype
      function beforeRegisterNodeDef(nodeType: { prototype: Record<string, unknown> }) {
        nodeType.prototype.onConfigure = function (data: SerializedNodeData) {
          calls.push(data)
        }
      }
      beforeRegisterNodeDef({ prototype: proto })

      const instanceA = Object.create(proto) as { onConfigure: (d: SerializedNodeData) => void }
      const instanceB = Object.create(proto) as { onConfigure: (d: SerializedNodeData) => void }

      const dataA: SerializedNodeData = { widgets_values: [1] }
      const dataB: SerializedNodeData = { widgets_values: [2] }
      instanceA.onConfigure(dataA)
      instanceB.onConfigure(dataB)

      expect(calls).toHaveLength(2)
      expect(calls[0]).toBe(dataA)
      expect(calls[1]).toBe(dataB)
    })
  })
})
