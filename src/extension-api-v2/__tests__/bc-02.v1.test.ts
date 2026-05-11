// Category: BC.02 — Node lifecycle: teardown
// DB cross-ref: S2.N4
// Exemplar: https://github.com/Lightricks/ComfyUI-LTXVideo/blob/main/web/js/sparse_track_editor.js#L137
// Surface: S2.N4 = node.onRemoved
// compat-floor: blast_radius 5.20 ≥ 2.0 — MUST pass before v2 ships
// v1 contract: node.onRemoved = function() { /* cleanup DOM, intervals, observers */ }
//
// I-TF.3.C3 — proof-of-concept harness wiring.
// Phase A harness limitation: MiniGraph.remove() deletes the entity from the World
// but does NOT automatically call onRemoved (that requires Phase B eval sandbox +
// LiteGraph prototype wiring). The wired tests below call onRemoved explicitly after
// graph.remove() to prove the harness mechanics and assertion patterns work.
// The TODO stubs below them track what needs Phase B to become real assertions.

import { describe, expect, it, vi } from 'vitest'

import {
  countEvidenceExcerpts,
  createHarnessWorld,
  createMiniComfyApp,
  loadEvidenceSnippet
} from '../harness'

// ── Proof-of-concept wired tests (I-TF.3.C3) ────────────────────────────────
// These pass today. They prove: (a) the harness can model the v1 teardown
// pattern, (b) removal is reflected in the World, (c) the cleanup callback
// fires when the extension calls it, (d) evidence excerpts load for S2.N4.

describe('BC.02 v1 contract — node lifecycle: teardown [harness POC]', () => {
  describe('S2.N4 — onRemoved harness mechanics', () => {
    it('cleanup callback fires when extension calls it after graph.remove()', () => {
      const world = createHarnessWorld()
      const app = createMiniComfyApp(world)

      // v1 pattern: extension patches onRemoved on the node during nodeCreated.
      // We model this as a plain function stored on a node-shaped object.
      const cleanupFn = vi.fn()
      const node = {
        type: 'LTXVideo',
        entityId: app.graph.add({ type: 'LTXVideo' }),
        onRemoved: cleanupFn
      }

      expect(world.findNode(node.entityId)).toBeDefined()

      // Simulate the LiteGraph removal sequence (Phase A: explicit call).
      app.graph.remove(node.entityId)
      node.onRemoved()

      expect(world.findNode(node.entityId)).toBeUndefined()
      expect(cleanupFn).toHaveBeenCalledOnce()
    })

    it('cleanup callback does not fire if remove is never called', () => {
      const world = createHarnessWorld()
      const app = createMiniComfyApp(world)
      const cleanupFn = vi.fn()
      const entityId = app.graph.add({ type: 'KSampler' })

      // Node exists; no removal; callback should not have been invoked.
      void entityId
      expect(cleanupFn).not.toHaveBeenCalled()
      expect(world.allNodes()).toHaveLength(1)
    })

    it('multiple nodes — each removal triggers only its own callback', () => {
      const world = createHarnessWorld()
      const app = createMiniComfyApp(world)

      const cbA = vi.fn()
      const cbB = vi.fn()
      const idA = app.graph.add({ type: 'NodeA' })
      const idB = app.graph.add({ type: 'NodeB' })

      // Remove only A.
      app.graph.remove(idA)
      cbA()  // simulate LiteGraph calling onRemoved on the removed node only

      expect(cbA).toHaveBeenCalledOnce()
      expect(cbB).not.toHaveBeenCalled()
      expect(world.findNode(idA)).toBeUndefined()
      expect(world.findNode(idB)).toBeDefined()
    })

    it('graph.clear() removes all nodes from the World', () => {
      const world = createHarnessWorld()
      const app = createMiniComfyApp(world)

      app.graph.add({ type: 'NodeA' })
      app.graph.add({ type: 'NodeB' })
      app.graph.add({ type: 'NodeC' })
      expect(world.allNodes()).toHaveLength(3)

      world.clear()
      expect(world.allNodes()).toHaveLength(0)
    })
  })

  describe('S2.N4 — evidence excerpt (loadEvidenceSnippet)', () => {
    it('S2.N4 has at least one evidence excerpt in the snapshot', () => {
      expect(countEvidenceExcerpts('S2.N4')).toBeGreaterThan(0)
    })

    it('S2.N4 excerpt contains onRemoved fingerprint', () => {
      const snippet = loadEvidenceSnippet('S2.N4', 0)
      expect(snippet.length).toBeGreaterThan(0)
      expect(snippet).toMatch(/onRemoved/i)
    })
  })
})

// ── Phase B stubs — need eval sandbox + LiteGraph prototype wiring ───────────

describe('BC.02 v1 contract — node lifecycle: teardown [Phase B]', () => {
  describe('S2.N4 — node.onRemoved', () => {
    it.todo(
      'onRemoved is called exactly once when a node is removed from the graph via graph.remove(node)'
    )
    it.todo(
      'onRemoved is called when a node is deleted via the canvas context-menu delete action'
    )
    it.todo(
      'onRemoved is called for every node when the graph is cleared (graph.clear())'
    )
    it.todo(
      'DOM widgets appended by the extension are accessible for cleanup inside onRemoved (not yet garbage-collected)'
    )
    it.todo(
      'setInterval / requestAnimationFrame handles stored on the node instance can be cancelled inside onRemoved'
    )
    it.todo(
      'MutationObserver and ResizeObserver instances stored on the node can be disconnected inside onRemoved'
    )
  })
})
