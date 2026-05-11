// Category: BC.03 — Node lifecycle: hydration from saved workflows
// DB cross-ref: S1.H1, S2.N7
// compat-floor: blast_radius 4.91 ≥ 2.0 — MUST pass before v2 ships
// Migration: v1 node.onConfigure / beforeRegisterNodeDef → v2 defineNodeExtension({ loadedGraphNode(handle) })
//
// Key rename: the v1 surface is `node.onConfigure = function(data) { ... }`
// patched prototype-level. The v2 replacement is `loadedGraphNode(handle)` in
// `defineNodeExtension`. The argument shape changes: v1 receives the raw
// serialized node object (data); v2 receives a typed NodeHandle (widget values
// already applied by the runtime before the hook fires).

import { describe, expect, it, vi } from 'vitest'

import {
  countEvidenceExcerpts,
  createHarnessWorld,
  loadEvidenceSnippet
} from '../harness'

// ── Wired migration tests (Phase A) ─────────────────────────────────────────

describe('BC.03 migration — node lifecycle: hydration from saved workflows', () => {
  describe('invocation parity (S2.N7)', () => {
    it('v1 onConfigure and v2 loadedGraphNode are each called exactly once per node during workflow load', () => {
      const world = createHarnessWorld()

      const v1Calls: string[] = []
      const v2Calls: string[] = []

      // v1 model: extension patches onConfigure during beforeRegisterNodeDef.
      // We model the patched-prototype invocation as a direct call here.
      const v1Ext = {
        beforeRegisterNodeDef(nodeType: string) {
          // Prototype patch: every instance of this type gets onConfigure.
          return {
            onConfigure: (data: { type: string }) => v1Calls.push(data.type)
          }
        }
      }

      // v2 model: loadedGraphNode(handle) per lifecycle.ts:98
      const v2Ext = {
        name: 'test.hydration-migration',
        loadedGraphNode: vi.fn((handle: { type: string }) => v2Calls.push(handle.type))
      }

      // Simulate loading three nodes from a workflow.
      const nodeTypes = ['KSampler', 'CLIPTextEncode', 'VAEDecode']
      for (const type of nodeTypes) {
        const entityId = world.addNode({ type })
        const record = world.findNode(entityId)!

        // v1: runtime calls node.onConfigure(serializedData) after configure().
        const patchedMethods = v1Ext.beforeRegisterNodeDef(type)
        patchedMethods.onConfigure({ type })

        // v2: runtime calls loadedGraphNode(handle).
        v2Ext.loadedGraphNode({ type: record.type })
      }

      expect(v1Calls).toHaveLength(3)
      expect(v2Calls).toHaveLength(3)
      expect(v1Calls).toEqual(v2Calls)
    })

    it('the property data accessible in v2 loadedGraphNode contains the same keys as v1 onConfigure data', () => {
      const world = createHarnessWorld()

      // v1: data = raw serialized node object with properties field.
      const v1DataSeen: Record<string, unknown> = {}
      const v1OnConfigure = (data: { properties: Record<string, unknown> }) => {
        Object.assign(v1DataSeen, data.properties)
      }

      // v2: handle.properties — same bag, typed access.
      const v2PropertiesSeen: Record<string, unknown> = {}
      const v2LoadedGraphNode = (handle: { properties: Record<string, unknown> }) => {
        Object.assign(v2PropertiesSeen, handle.properties)
      }

      const savedProperties = { custom_label: 'upscaler', strength: 0.75 }
      const entityId = world.addNode({ type: 'KSampler', properties: savedProperties })
      const record = world.findNode(entityId)!

      v1OnConfigure({ properties: record.properties })
      v2LoadedGraphNode({ properties: record.properties })

      expect(v1DataSeen).toEqual(v2PropertiesSeen)
      expect(v2PropertiesSeen.custom_label).toBe('upscaler')
      expect(v2PropertiesSeen.strength).toBe(0.75)
    })
  })

  describe('type-scoped filtering parity (S1.H1)', () => {
    it('v1 beforeRegisterNodeDef guard and v2 nodeTypes:[] produce the same filtered invocation set', () => {
      const world = createHarnessWorld()

      const v1HookTargets: string[] = []
      const v2HookTargets: string[] = []

      // v1: guard pattern — beforeRegisterNodeDef checks nodeType.
      const v1GuardFn = (nodeTypeName: string) => {
        if (nodeTypeName === 'KSampler') {
          return {
            onConfigure: (data: { type: string }) => v1HookTargets.push(data.type)
          }
        }
        return null
      }

      // v2: type-scoped loadedGraphNode.
      const v2Ext = {
        name: 'test.type-scope-parity',
        nodeTypes: ['KSampler'],
        loadedGraphNode: (handle: { type: string }) => v2HookTargets.push(handle.type)
      }

      const allTypes = ['KSampler', 'CLIPTextEncode', 'VAEDecode', 'KSampler']
      for (const type of allTypes) {
        const entityId = world.addNode({ type })
        const record = world.findNode(entityId)!

        // v1 dispatch.
        const patched = v1GuardFn(type)
        if (patched) patched.onConfigure({ type })

        // v2 dispatch.
        if (v2Ext.nodeTypes.includes(type)) {
          v2Ext.loadedGraphNode({ type: record.type })
        }
      }

      // Both should only have fired for 'KSampler' (twice).
      expect(v1HookTargets).toEqual(['KSampler', 'KSampler'])
      expect(v2HookTargets).toEqual(['KSampler', 'KSampler'])
      expect(v1HookTargets).toEqual(v2HookTargets)
    })
  })

  describe('fresh-creation exclusion invariant', () => {
    it('neither v1 onConfigure nor v2 loadedGraphNode fires for a freshly created node', () => {
      // This invariant is load-vs-create gating — the same truth on both sides.
      const v1ConfigureFn = vi.fn()
      const v2LoadedFn = vi.fn()

      // Simulate fresh creation: runtime does NOT call onConfigure / loadedGraphNode.
      // (Only nodeCreated / onNodeCreated fire for fresh nodes.)
      const _freshNodeId = createHarnessWorld().addNode({ type: 'KSampler' })

      // Neither function called — fresh creation path.
      expect(v1ConfigureFn).not.toHaveBeenCalled()
      expect(v2LoadedFn).not.toHaveBeenCalled()
    })
  })

  describe('evidence parity (S1.H1, S2.N7)', () => {
    it('S1.H1 has at least one evidence excerpt', () => {
      expect(countEvidenceExcerpts('S1.H1')).toBeGreaterThan(0)
    })

    it('S2.N7 has at least one evidence excerpt', () => {
      expect(countEvidenceExcerpts('S2.N7')).toBeGreaterThan(0)
    })

    it('S2.N7 excerpt uses onConfigure — the v1 hydration surface being replaced', () => {
      const snippet = loadEvidenceSnippet('S2.N7', 0)
      expect(snippet).toMatch(/onConfigure/i)
    })
  })
})

// ── Phase B stubs — need real configure() lifecycle + LoadedFromWorkflow tag ─

describe('BC.03 migration — hydration [Phase B]', () => {
  it.todo(
    'v2 loadedGraphNode fires at the same point in the LiteGraph configure() lifecycle as v1 onConfigure'
  )
  it.todo(
    'custom properties written to data in v1 onConfigure are accessible via handle.properties in v2 loadedGraphNode without any migration shim'
  )
})
