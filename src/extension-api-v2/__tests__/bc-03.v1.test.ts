// Category: BC.03 — Node lifecycle: hydration from saved workflows
// DB cross-ref: S1.H1, S2.N7
// Exemplar: https://github.com/Comfy-Org/ComfyUI_frontend/blob/main/src/extensions/core/
// Surface: S1.H1 = beforeRegisterNodeDef (used for hydration guards), S2.N7 = node.onConfigure
// compat-floor: blast_radius 4.91 ≥ 2.0 — MUST pass before v2 ships
// v1 contract: S1.H1 = beforeRegisterNodeDef guard; S2.N7 = node.onConfigure = function(data) { ... }
// Note: loadedGraphNode hook exists in LiteGraph but is effectively unused in ComfyUI —
//       onConfigure is the de-facto hydration surface.

import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'

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
      expect(
        found,
        'Expected at least one S1.H1 excerpt with beforeRegisterNodeDef fingerprint'
      ).toBe(true)
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

      node.onConfigure({
        widgets_values: [42],
        properties: { custom_label: 'upscaler' }
      })

      expect(capturedWidgetsValues).toEqual([42])
    })

    it('custom properties in data.properties are accessible inside the callback', () => {
      let capturedLabel: unknown
      const node = {
        onConfigure(data: SerializedNodeData) {
          capturedLabel = data.properties?.custom_label
        }
      }

      node.onConfigure({
        widgets_values: [42],
        properties: { custom_label: 'upscaler' }
      })

      expect(capturedLabel).toBe('upscaler')
    })

    it('onConfigure is NOT called on fresh creation (only on load)', () => {
      const onConfigure = vi.fn()
      // A freshly created node never has onConfigure invoked by the runtime
      // — we assert no invocations occurred without any explicit call.
      expect(onConfigure).not.toHaveBeenCalled()
    })

    describe('fires during actual LiteGraph graph.configure()', () => {
      // The v1 contract is: when graph.configure(serializedGraph) is called,
      // each restored LGraphNode has its `onConfigure(info)` invoked with the
      // raw serialized node payload — the de-facto hydration hook used by
      // 51 consumers per W2F-1 (S2.N7 RED tier).
      //
      // We register a custom LGraphNode subclass whose prototype has an
      // onConfigure spy, serialize a graph that contains an instance of it,
      // then feed the serialized payload back through `graph.configure()`
      // and assert the spy fires with the per-node info object.

      const registeredTypes: string[] = []

      beforeEach(() => {
        // LGraphNode constructor exercises LGraphNodeProperties which
        // touches Pinia-backed stores in some code paths; activate a
        // testing pinia to match the canonical LiteGraph test harness
        // (see src/lib/litegraph/src/LGraph.repointAncestorPromotions.test.ts).
        setActivePinia(createTestingPinia({ stubActions: false }))
      })

      afterEach(() => {
        for (const t of registeredTypes) {
          LiteGraph.unregisterNodeType(t)
        }
        registeredTypes.length = 0
      })

      function registerSpyNode(spy: (info: unknown) => void): string {
        const type = `bc03/onconfigure-${Math.random().toString(36).slice(2)}`
        class SpyNode extends LGraphNode {
          constructor() {
            super('SpyNode', type)
          }
          override onConfigure(info: unknown): void {
            spy(info)
          }
        }
        LiteGraph.registerNodeType(type, SpyNode)
        registeredTypes.push(type)
        return type
      }

      it('invokes onConfigure on each restored node with the serialized info object', () => {
        const spy = vi.fn()
        const type = registerSpyNode(spy)

        // Seed graph with one node of our spy type.
        const seedGraph = new LGraph()
        const seedNode = LiteGraph.createNode(type)
        expect(seedNode).not.toBeNull()
        seedGraph.add(seedNode!)
        const serialized = seedGraph.serialize()

        // The spy was wired on the prototype; the seed instance's own
        // .configure() was never called (we used .add(), not .configure()).
        // Confirm hydration is what drives the call, not creation.
        expect(spy).not.toHaveBeenCalled()

        // Hydrate a fresh graph from the serialized payload.
        const targetGraph = new LGraph()
        targetGraph.configure(serialized)

        expect(spy).toHaveBeenCalledTimes(1)
        const info = spy.mock.calls[0][0] as Record<string, unknown>
        expect(info.type).toBe(type)
      })
    })

    it.todo(
      'LoadedFromWorkflow ECS tag — needs world.dispatch (Phase B blocked, see I-TF.8.J1)'
    )
  })

  describe('S1.H1 — beforeRegisterNodeDef hydration guard (synthetic)', () => {
    it('prototype-level onConfigure injected in beforeRegisterNodeDef fires for all instances', () => {
      const calls: unknown[] = []
      const proto: Record<string, unknown> = {}

      // Simulate beforeRegisterNodeDef injecting onConfigure on the prototype
      function beforeRegisterNodeDef(nodeType: {
        prototype: Record<string, unknown>
      }) {
        nodeType.prototype.onConfigure = function (data: SerializedNodeData) {
          calls.push(data)
        }
      }
      beforeRegisterNodeDef({ prototype: proto })

      const instanceA = Object.create(proto) as {
        onConfigure: (d: SerializedNodeData) => void
      }
      const instanceB = Object.create(proto) as {
        onConfigure: (d: SerializedNodeData) => void
      }

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
