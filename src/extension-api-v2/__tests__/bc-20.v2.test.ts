// Category: BC.20 — Custom node-type registration (frontend-only / virtual)
// DB cross-ref: S1.H5, S1.H6, S8.P1
// Exemplar: https://github.com/Comfy-Org/ComfyUI_frontend/blob/main/src/extensions/core/rerouteNode.ts
// blast_radius: 5.49 — compat-floor: MUST pass before v2 ships
//
// Phase A findings (from lifecycle.ts inspection):
// - NodeExtensionOptions does NOT yet have `virtual: true` or `resolveConnections` fields.
//   These are planned for Phase B per D6 §Q5 decision.
// - What IS testable today: NodeExtensionOptions shape, defineNodeExtension registration,
//   type-scoped filtering (nodeTypes:[]), and the documented gap.
//
// I-TF.8 — BC.20 v2 wired assertions.

import { describe, expect, it } from 'vitest'
import type { NodeExtensionOptions, WidgetExtensionOptions } from '@/extension-api/lifecycle'

// ── Type-shape helpers ────────────────────────────────────────────────────────

/** Simulate the runtime registration registry (no ECS dependency). */
function createNodeExtensionRegistry() {
  const extensions: NodeExtensionOptions[] = []
  return {
    register(opts: NodeExtensionOptions) { extensions.push(opts) },
    getAll() { return [...extensions] },
    findByName(name: string) { return extensions.find((e) => e.name === name) },
    clear() { extensions.length = 0 }
  }
}

function createWidgetExtensionRegistry() {
  const extensions: WidgetExtensionOptions[] = []
  return {
    register(opts: WidgetExtensionOptions) { extensions.push(opts) },
    findByType(type: string) { return extensions.find((e) => e.type === type) },
    clear() { extensions.length = 0 }
  }
}

// ── Wired assertions (Phase A) ────────────────────────────────────────────────

describe('BC.20 v2 contract — custom node-type registration', () => {
  describe('NodeExtensionOptions shape — what is testable today', () => {
    it('NodeExtensionOptions accepts name, nodeTypes, nodeCreated, loadedGraphNode', () => {
      // Type-shape assertion: if this compiles, the interface is correct.
      const opts: NodeExtensionOptions = {
        name: 'bc20.test.reroute',
        nodeTypes: ['RerouteNode'],
        nodeCreated(_node) {},
        loadedGraphNode(_node) {}
      }
      expect(opts.name).toBe('bc20.test.reroute')
      expect(opts.nodeTypes).toEqual(['RerouteNode'])
      expect(typeof opts.nodeCreated).toBe('function')
      expect(typeof opts.loadedGraphNode).toBe('function')
    })

    it('NodeExtensionOptions with no nodeTypes is valid (global registration — all node types)', () => {
      const opts: NodeExtensionOptions = { name: 'bc20.test.global' }
      const reg = createNodeExtensionRegistry()
      reg.register(opts)
      expect(reg.findByName('bc20.test.global')).toBeDefined()
      expect(reg.findByName('bc20.test.global')!.nodeTypes).toBeUndefined()
    })

    it('multiple extensions can register the same nodeTypes without conflict', () => {
      const reg = createNodeExtensionRegistry()
      reg.register({ name: 'bc20.test.extA', nodeTypes: ['SetNode'] })
      reg.register({ name: 'bc20.test.extB', nodeTypes: ['SetNode'] })
      const all = reg.getAll()
      expect(all).toHaveLength(2)
      expect(all.every((e) => e.nodeTypes?.includes('SetNode'))).toBe(true)
    })

    it('name is the unique identity key for the registry', () => {
      const reg = createNodeExtensionRegistry()
      reg.register({ name: 'bc20.test.unique', nodeTypes: ['A'] })
      const found = reg.findByName('bc20.test.unique')
      expect(found).toBeDefined()
      expect(found!.name).toBe('bc20.test.unique')
    })
  })

  describe('nodeTypes filter — dispatch simulation', () => {
    it('type-scoped extension only receives nodes matching nodeTypes', () => {
      const received: string[] = []
      const ext: NodeExtensionOptions = {
        name: 'bc20.test.type-scoped',
        nodeTypes: ['RerouteNode'],
        nodeCreated(node) { received.push(node.type) }
      }

      // Simulate runtime dispatch (filter by nodeTypes before calling hook).
      const allTypes = ['RerouteNode', 'KSampler', 'RerouteNode', 'CLIPTextEncode']
      for (const type of allTypes) {
        if (!ext.nodeTypes || ext.nodeTypes.includes(type)) {
          // Minimal handle stub — only `type` matters here.
          ext.nodeCreated?.({ type, comfyClass: type } as Parameters<NonNullable<typeof ext.nodeCreated>>[0])
        }
      }

      expect(received).toEqual(['RerouteNode', 'RerouteNode'])
    })

    it('global extension (no nodeTypes) receives all node types', () => {
      const received: string[] = []
      const ext: NodeExtensionOptions = {
        name: 'bc20.test.global-dispatch',
        nodeCreated(node) { received.push(node.type) }
      }

      const allTypes = ['RerouteNode', 'KSampler', 'CLIPTextEncode']
      for (const type of allTypes) {
        if (!ext.nodeTypes || ext.nodeTypes.includes(type)) {
          ext.nodeCreated?.({ type, comfyClass: type } as Parameters<NonNullable<typeof ext.nodeCreated>>[0])
        }
      }

      expect(received).toHaveLength(3)
    })
  })

  describe('WidgetExtensionOptions shape — custom widget type', () => {
    it('WidgetExtensionOptions accepts name, type, widgetCreated', () => {
      const opts: WidgetExtensionOptions = {
        name: 'bc20.test.color-picker',
        type: 'COLOR_PICKER',
        widgetCreated(_widget, _parentNode) {
          return {
            render(_container: HTMLElement) {},
            destroy() {}
          }
        }
      }
      expect(opts.type).toBe('COLOR_PICKER')
      expect(typeof opts.widgetCreated).toBe('function')
    })

    it('WidgetExtensionOptions.type is the unique widget type key', () => {
      const reg = createWidgetExtensionRegistry()
      reg.register({ name: 'bc20.test.wext', type: 'MY_WIDGET' })
      expect(reg.findByType('MY_WIDGET')).toBeDefined()
      expect(reg.findByType('UNKNOWN_TYPE')).toBeUndefined()
    })
  })

  describe('[gap] virtual: true and resolveConnections — Phase B', () => {
    it.todo(
      '[gap] NodeExtensionOptions does not yet have a `virtual: true` field. ' +
      'Phase B: add virtual?: boolean to NodeExtensionOptions per D6 §Q5 decision. ' +
      'Virtual nodes are excluded from the ECS spec edges / graphToPrompt output.'
    )
    it.todo(
      '[gap] NodeExtensionOptions does not yet have resolveConnections(node, graph) → edges[]. ' +
      'Phase B: KJNodes-style Set/Get node virtual wiring. See D6 §Q5 for full API shape.'
    )
    it.todo(
      '[gap] isVirtualNode=true prototype property (S8.P1) has no v2 equivalent until Phase B virtual:true lands. ' +
      'Until then, extensions must continue using the v1 isVirtualNode pattern.'
    )
  })
})

// ── Phase B stubs ─────────────────────────────────────────────────────────────

describe('BC.20 v2 contract — virtual node registration [Phase B]', () => {
  describe('virtual: true exclusion from ECS spec edges', () => {
    it.todo(
      'NodeExtensionOptions { virtual: true } excludes matching nodes from world.entitiesWith(SpecEdgeKey)'
    )
    it.todo(
      'virtual: true nodes are present in the canvas World but absent from the graphToPrompt payload'
    )
  })

  describe('resolveConnections(node, graph) → ResolvedEdges', () => {
    it.todo(
      'resolveConnections is called at prompt-build time with a read-only graph view'
    )
    it.todo(
      'returned edges replace the virtual node links in the spec with direct source→target connections'
    )
    it.todo(
      'resolveConnections must be a pure function — mutations to node/graph are rejected in dev mode'
    )
  })
})
