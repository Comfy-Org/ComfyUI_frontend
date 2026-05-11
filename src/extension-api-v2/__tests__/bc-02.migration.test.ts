// Category: BC.02 — Node lifecycle: teardown
// DB cross-ref: S2.N4
// Exemplar: https://github.com/Lightricks/ComfyUI-LTXVideo/blob/main/web/js/sparse_track_editor.js#L137
// compat-floor: blast_radius 5.20 ≥ 2.0 — MUST pass before v2 ships
// Migration: v1 node.onRemoved assignment → v2 defineNodeExtension({ onRemoved(handle) })
//
// These tests prove that v1 and v2 teardown produce identical outcomes on the
// same sequence of graph operations. "Identical" means:
//   - cleanup fires the same number of times
//   - cleanup fires AFTER the node is absent from the graph
//   - cleanup closures can access the same mutable resources (interval, observer)
//
// Phase A harness note: v2 is modelled with effectScope + onScopeDispose (the
// primitive `onNodeRemoved` delegates to). v1 is modelled with a plain
// node.onRemoved assignment called explicitly after graph.remove(), matching
// how LiteGraph invokes the hook in production.
//
// I-TF.8.A2 — BC.02 migration wired assertions.

import { describe, expect, it, vi } from 'vitest'
import { effectScope, onScopeDispose } from 'vue'

import {
  createHarnessWorld,
  createMiniComfyApp,
  loadEvidenceSnippet
} from '../harness'

// ── Shared helpers ────────────────────────────────────────────────────────────

function mountV2(setup: () => void) {
  const scope = effectScope()
  scope.run(setup)
  return { unmount: () => scope.stop() }
}

// ── Wired assertions ──────────────────────────────────────────────────────────

describe('BC.02 migration — node lifecycle: teardown', () => {
  describe('invocation parity (S2.N4)', () => {
    it('v1 onRemoved and v2 onScopeDispose are both called exactly once for a single node removal', () => {
      const world = createHarnessWorld()
      const app = createMiniComfyApp(world)

      // v1 pattern
      const v1Cleanup = vi.fn()
      const entityId = app.graph.add({ type: 'LTXSparseTrack' })
      const v1Node = { entityId, onRemoved: v1Cleanup }

      // v2 pattern
      const v2Cleanup = vi.fn()
      const v2Mount = mountV2(() => { onScopeDispose(v2Cleanup) })

      expect(v1Cleanup).not.toHaveBeenCalled()
      expect(v2Cleanup).not.toHaveBeenCalled()

      // Simulate removal
      app.graph.remove(entityId)
      v1Node.onRemoved()   // LiteGraph calls this after graph removal
      v2Mount.unmount()    // service calls scope.stop() after graph removal

      expect(v1Cleanup).toHaveBeenCalledOnce()
      expect(v2Cleanup).toHaveBeenCalledOnce()
    })

    it('both v1 and v2 cleanup fire AFTER the node is absent from the graph', () => {
      const world = createHarnessWorld()
      const app = createMiniComfyApp(world)

      const entityId = app.graph.add({ type: 'KSampler' })

      const observations: { v1NodeGone: boolean; v2NodeGone: boolean } = {
        v1NodeGone: false,
        v2NodeGone: false
      }

      const v1Node = {
        entityId,
        onRemoved() {
          observations.v1NodeGone = world.findNode(entityId) === undefined
        }
      }

      const v2Mount = mountV2(() => {
        onScopeDispose(() => {
          observations.v2NodeGone = world.findNode(entityId) === undefined
        })
      })

      app.graph.remove(entityId)    // removes from world
      v1Node.onRemoved()
      v2Mount.unmount()

      expect(observations.v1NodeGone).toBe(true)
      expect(observations.v2NodeGone).toBe(true)
    })

    it('v1 and v2 teardown are both called the correct number of times across multiple nodes', () => {
      const world = createHarnessWorld()
      const app = createMiniComfyApp(world)

      const v1Calls: string[] = []
      const v2Calls: string[] = []

      const nodes = ['NodeA', 'NodeB', 'NodeC'].map((type) => {
        const entityId = app.graph.add({ type })
        const v2 = mountV2(() => {
          onScopeDispose(() => v2Calls.push(type))
        })
        return { type, entityId, onRemoved: () => v1Calls.push(type), v2 }
      })

      // Remove all in sequence
      for (const node of nodes) {
        app.graph.remove(node.entityId)
        node.onRemoved()
        node.v2.unmount()
      }

      expect(v1Calls).toEqual(['NodeA', 'NodeB', 'NodeC'])
      expect(v2Calls).toEqual(['NodeA', 'NodeB', 'NodeC'])
    })
  })

  describe('resource cleanup equivalence', () => {
    it('interval cleared in v1 onRemoved is equivalently cleared in v2 onScopeDispose', () => {
      vi.useFakeTimers()

      const v1Ticks = vi.fn()
      const v2Ticks = vi.fn()

      let v1Handle: ReturnType<typeof setInterval> | undefined
      let v2Handle: ReturnType<typeof setInterval> | undefined

      // v1 pattern: manual tracking
      v1Handle = setInterval(v1Ticks, 100)
      const v1Node = {
        onRemoved() {
          clearInterval(v1Handle)
        }
      }

      // v2 pattern: closure via onScopeDispose
      const v2Mount = mountV2(() => {
        v2Handle = setInterval(v2Ticks, 100)
        onScopeDispose(() => clearInterval(v2Handle))
      })

      vi.advanceTimersByTime(250)
      expect(v1Ticks).toHaveBeenCalledTimes(2)
      expect(v2Ticks).toHaveBeenCalledTimes(2)

      // Teardown both
      v1Node.onRemoved()
      v2Mount.unmount()

      vi.advanceTimersByTime(500)
      // Neither should tick after teardown
      expect(v1Ticks).toHaveBeenCalledTimes(2)
      expect(v2Ticks).toHaveBeenCalledTimes(2)

      vi.useRealTimers()
    })

    it('observer.disconnect() pattern is equivalent between v1 and v2', () => {
      const v1Observer = { disconnect: vi.fn() }
      const v2Observer = { disconnect: vi.fn() }

      // v1: manual disconnect in onRemoved
      const v1Node = { onRemoved: () => v1Observer.disconnect() }

      // v2: disconnect registered via onScopeDispose
      const v2Mount = mountV2(() => {
        onScopeDispose(() => v2Observer.disconnect())
      })

      expect(v1Observer.disconnect).not.toHaveBeenCalled()
      expect(v2Observer.disconnect).not.toHaveBeenCalled()

      v1Node.onRemoved()
      v2Mount.unmount()

      expect(v1Observer.disconnect).toHaveBeenCalledOnce()
      expect(v2Observer.disconnect).toHaveBeenCalledOnce()
    })

    it('DOM element cleanup in v1 onRemoved is equivalent to onScopeDispose in v2', () => {
      // Model DOM element as an object with a `remove()` method
      const v1El = { remove: vi.fn(), isConnected: true }
      const v2El = { remove: vi.fn(), isConnected: true }

      const v1Node = {
        onRemoved() {
          v1El.remove()
          v1El.isConnected = false
        }
      }

      const v2Mount = mountV2(() => {
        onScopeDispose(() => {
          v2El.remove()
          v2El.isConnected = false
        })
      })

      v1Node.onRemoved()
      v2Mount.unmount()

      expect(v1El.remove).toHaveBeenCalledOnce()
      expect(v1El.isConnected).toBe(false)
      expect(v2El.remove).toHaveBeenCalledOnce()
      expect(v2El.isConnected).toBe(false)
    })
  })

  describe('graph clear coverage', () => {
    it('both v1 and v2 teardown hooks are invoked for all nodes when world.clear() is called', () => {
      const world = createHarnessWorld()
      const app = createMiniComfyApp(world)

      const v1Counts = { NodeA: 0, NodeB: 0 }
      const v2Counts = { NodeA: 0, NodeB: 0 }

      const nodeA = {
        entityId: app.graph.add({ type: 'NodeA' }),
        onRemoved: () => v1Counts.NodeA++,
        v2: mountV2(() => { onScopeDispose(() => v2Counts.NodeA++) })
      }
      const nodeB = {
        entityId: app.graph.add({ type: 'NodeB' }),
        onRemoved: () => v1Counts.NodeB++,
        v2: mountV2(() => { onScopeDispose(() => v2Counts.NodeB++) })
      }

      expect(world.allNodes()).toHaveLength(2)

      // Simulate graph clear
      world.clear()
      nodeA.onRemoved()
      nodeA.v2.unmount()
      nodeB.onRemoved()
      nodeB.v2.unmount()

      expect(world.allNodes()).toHaveLength(0)
      expect(v1Counts).toEqual({ NodeA: 1, NodeB: 1 })
      expect(v2Counts).toEqual({ NodeA: 1, NodeB: 1 })
    })
  })

  describe('S2.N4 — evidence excerpt shows real-world migration target', () => {
    it('evidence excerpt content matches onRemoved v1 pattern', () => {
      const snippet = loadEvidenceSnippet('S2.N4', 0)
      // The real evidence should contain the v1 pattern the migration replaces
      expect(snippet).toMatch(/onRemoved/i)
    })
  })
})

// ── Phase B stubs ─────────────────────────────────────────────────────────────

describe('BC.02 migration — node lifecycle: teardown [Phase B]', () => {
  describe('end-to-end migration equivalence via eval sandbox', () => {
    it.todo(
      'v1 snippet from S2.N4 evidence, replayed via runV1(), produces the same cleanup count as a v2 port via runV2()'
    )
    it.todo(
      'v1 onRemoved fires at the same position in the LiteGraph removal sequence as v2 scope.stop()'
    )
    it.todo(
      'subgraph promotion (DOM move) does NOT fire v2 teardown, matching v1 behavior where onRemoved is not called on promotion'
    )
  })
})
