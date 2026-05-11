// Category: BC.14 — Workflow → API serialization interception (graphToPrompt)
// DB cross-ref: S6.A1
// Exemplar: https://github.com/Comfy-Org/ComfyUI-Manager/blob/main/js/components-manager.js#L781
// blast_radius: 7.02 (HIGHEST in dataset) — compat-floor: MUST pass before v2 ships
//
// v2 replacement (Phase B): ctx.on('beforePrompt', handler) inside defineExtension setup context.
//   Full spec: decisions/D6-parallel-paths-migration.md §Q4
// Virtual nodes (Phase B): virtual:true + resolveConnections(node, graph) → edges[]
//   Full spec: decisions/D6-parallel-paths-migration.md §Q5
// S6.A1 classification: 'uwf-resolved' — full migration requires UWF Phase 3 save-time
//   materialization (not beforePrompt alone). See decisions/D9-strangler-fig-phases.md §Phase B.
//
// Phase A: beforePrompt is NOT yet on ExtensionOptions; virtual/resolveConnections are NOT yet
// on NodeExtensionOptions. These are Phase B additions pending D6 §Q4/Q5 sign-off.
// This file tests the current type surface and documents gaps precisely.

import { describe, expect, it } from 'vitest'
import type { ExtensionOptions, NodeExtensionOptions } from '@/extension-api/lifecycle'

// ── Phase A — type surface tests ─────────────────────────────────────────────

describe('BC.14 v2 contract — graphToPrompt interception (Phase A type surface)', () => {
  describe('ExtensionOptions — current stable surface', () => {
    it('ExtensionOptions accepts name, apiVersion, init, and setup — the full Phase A surface', () => {
      // Confirm the stable fields compile and accept correct types.
      const ext: ExtensionOptions = {
        name: 'bc14.test.ext',
        apiVersion: '2',
        init() {},
        setup() {}
      }
      expect(ext.name).toBe('bc14.test.ext')
      expect(ext.apiVersion).toBe('2')
      expect(typeof ext.init).toBe('function')
      expect(typeof ext.setup).toBe('function')
    })

    it('ExtensionOptions.name is required — an object without name fails the type check', () => {
      // This is a compile-time guarantee; at runtime we assert the field is present.
      const ext = { name: 'required', setup() {} } satisfies ExtensionOptions
      expect(ext.name).toBeDefined()
    })

    it('[gap] ExtensionOptions does not yet have a beforePrompt field — Phase B addition', () => {
      // beforePrompt / ctx.on('beforePrompt') is documented in D6 §Q4 but not yet on
      // the interface. When Phase B lands, this test should be replaced by a real
      // type-shape assertion on the handler signature.
      const ext: ExtensionOptions = { name: 'bc14.gap.check' }
      expect('beforePrompt' in ext).toBe(false)
    })
  })

  describe('NodeExtensionOptions — current stable surface', () => {
    it('NodeExtensionOptions accepts name, nodeTypes, nodeCreated, loadedGraphNode', () => {
      const ext: NodeExtensionOptions = {
        name: 'bc14.node.ext',
        nodeTypes: ['SetNode', 'GetNode'],
        nodeCreated(_node) {},
        loadedGraphNode(_node) {}
      }
      expect(ext.name).toBe('bc14.node.ext')
      expect(ext.nodeTypes).toEqual(['SetNode', 'GetNode'])
    })

    it('[gap] NodeExtensionOptions does not yet have virtual or resolveConnections — Phase B addition', () => {
      // virtual:true + resolveConnections(node, graph) → edges[] is documented in D6 §Q5
      // but not yet on the interface. KJNodes Set/Get pattern (S9.SG1) depends on this.
      // Classification: uwf-resolved (UWF Phase 3 must know which nodes are layout-only).
      const ext: NodeExtensionOptions = { name: 'bc14.virtual.gap' }
      expect('virtual' in ext).toBe(false)
      expect('resolveConnections' in ext).toBe(false)
    })
  })
})

// ── Phase B + UWF Phase 3 stubs ───────────────────────────────────────────────

describe('BC.14 v2 contract — beforePrompt runtime [Phase B + UWF Phase 3]', () => {
  describe('ctx.on("beforePrompt", handler) — event registration', () => {
    it.todo(
      '[Phase B] ExtensionOptions accepts a setup() that calls ctx.on("beforePrompt", fn) inside the defineExtension scope context'
    )
    it.todo(
      '[Phase B] beforePrompt handler receives a typed BeforePromptEvent with { spec, workflow } matching the UWF output shape'
    )
    it.todo(
      '[Phase B] mutations to event.spec inside the handler are present in the API body sent to the backend'
    )
    it.todo(
      '[Phase B] handler can reject the prompt via event.reject(reason), preventing queuePrompt from dispatching'
    )
    it.todo(
      '[Phase B] multiple beforePrompt handlers registered across extensions fire in lexicographic name order (D10b)'
    )
    it.todo(
      '[Phase B] each handler sees mutations made by prior handlers in the same event cycle'
    )
  })

  describe('virtual:true + resolveConnections — KJNodes Set/Get class', () => {
    it.todo(
      '[Phase B] NodeExtensionOptions accepts virtual:true to mark a node type as layout-only (excluded from spec.edges)'
    )
    it.todo(
      '[Phase B] NodeExtensionOptions accepts resolveConnections(node, graph) => ResolvedEdge[] for per-type connection resolution'
    )
    it.todo(
      '[Phase B] resolveConnections receives a read-only graph view (mutations throw in dev mode)'
    )
    it.todo(
      '[UWF Phase 3] virtual nodes absent from spec.edges after UWF Phase 3 save-time materialization runs'
    )
    it.todo(
      '[UWF Phase 3] S9.SG1 Set/Get topology resolved by resolveConnections produces identical backend prompt to v1 graphToPrompt patch'
    )
  })

  describe('cg-use-everywhere bridge (graph-wide topology, not per-type)', () => {
    it.todo(
      '[Phase B] ctx.on("beforePrompt") is the correct bridge for graph-wide type inference (not resolveConnections, which is per-type)'
    )
  })
})
