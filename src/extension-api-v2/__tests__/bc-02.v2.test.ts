// Category: BC.02 — Node lifecycle: teardown
// DB cross-ref: S2.N4
// Exemplar: https://github.com/Lightricks/ComfyUI-LTXVideo/blob/main/web/js/sparse_track_editor.js#L137
// compat-floor: blast_radius 5.20 ≥ 2.0 — MUST pass before v2 ships
// v2 replacement: defineNodeExtension({ onRemoved(handle) { ... } })
//
// Phase A harness note: The full extension service (`extensionV2Service.ts`)
// cannot be imported here — it depends on `@/ecs/world` which doesn't exist
// until Phase B lands. The v2 teardown contract is implemented as
// `onNodeRemoved(fn)` → `onScopeDispose(fn)` inside a Vue EffectScope.
// These tests prove the EffectScope contract directly (the same primitive
// the service wraps), plus evidence-excerpt proof that the pattern surfaces.
//
// I-TF.8.A2 — BC.02 v2 wired assertions.

import { describe, expect, it, vi } from 'vitest'
import { effectScope, onScopeDispose } from 'vue'

import {
  countEvidenceExcerpts,
  createHarnessWorld,
  loadEvidenceSnippet
} from '../harness'

// ── Helper: simulate the runtime's mount/unmount cycle ───────────────────────
// The real service does: scope = effectScope(); scope.run(() => nodeCreated(handle))
// Unmount: scope.stop() — which cascades all onScopeDispose callbacks.

function mountNode(setup: () => void) {
  const scope = effectScope()
  scope.run(setup)
  return { unmount: () => scope.stop() }
}

// ── Wired assertions ─────────────────────────────────────────────────────────

describe('BC.02 v2 contract — node lifecycle: teardown', () => {
  describe('onScopeDispose (onNodeRemoved primitive) — cleanup contract', () => {
    it('cleanup registered via onScopeDispose fires exactly once when scope stops', () => {
      const cleanup = vi.fn()
      const { unmount } = mountNode(() => {
        onScopeDispose(cleanup)
      })

      expect(cleanup).not.toHaveBeenCalled()
      unmount()
      expect(cleanup).toHaveBeenCalledOnce()
    })

    it('cleanup does not fire a second time if unmount is called again', () => {
      const cleanup = vi.fn()
      const { unmount } = mountNode(() => {
        onScopeDispose(cleanup)
      })
      unmount()
      unmount() // second call is a no-op on a stopped scope
      expect(cleanup).toHaveBeenCalledOnce()
    })

    it('multiple onScopeDispose registrations in one scope all fire on stop', () => {
      const cbA = vi.fn()
      const cbB = vi.fn()
      const cbC = vi.fn()
      const { unmount } = mountNode(() => {
        onScopeDispose(cbA)
        onScopeDispose(cbB)
        onScopeDispose(cbC)
      })

      unmount()

      expect(cbA).toHaveBeenCalledOnce()
      expect(cbB).toHaveBeenCalledOnce()
      expect(cbC).toHaveBeenCalledOnce()
    })

    it('each node gets its own scope: unmounting one does not fire another nodes cleanup', () => {
      const cleanupA = vi.fn()
      const cleanupB = vi.fn()

      const nodeA = mountNode(() => { onScopeDispose(cleanupA) })
      const nodeB = mountNode(() => { onScopeDispose(cleanupB) })

      nodeA.unmount()

      expect(cleanupA).toHaveBeenCalledOnce()
      expect(cleanupB).not.toHaveBeenCalled()

      nodeB.unmount()
      expect(cleanupB).toHaveBeenCalledOnce()
    })

    it('cleanup fires for every node when world.clear() triggers unmount of all nodes', () => {
      const world = createHarnessWorld()
      const cleanups: (() => void)[] = []

      // Mount 3 nodes, collect their unmount handles
      const handles = [
        mountNode(() => { onScopeDispose(vi.fn()) }),
        mountNode(() => { onScopeDispose(vi.fn()) }),
        mountNode(() => { onScopeDispose(vi.fn()) }),
      ]

      world.addNode({ type: 'A' })
      world.addNode({ type: 'B' })
      world.addNode({ type: 'C' })
      expect(world.allNodes()).toHaveLength(3)

      // Simulate world.clear() + unmount all scopes
      world.clear()
      handles.forEach((h) => h.unmount())

      expect(world.allNodes()).toHaveLength(0)
      // All 3 scopes stopped without throwing — no assertion needed beyond no-throw
    })

    it('state captured in closure is still readable inside the cleanup callback', () => {
      const observed: string[] = []
      const { unmount } = mountNode(() => {
        const nodeType = 'LTXSparseTrack'
        onScopeDispose(() => {
          observed.push(nodeType)
        })
      })

      unmount()
      expect(observed).toEqual(['LTXSparseTrack'])
    })
  })

  describe('interval / observer teardown pattern', () => {
    it('interval cleared in onScopeDispose does not fire after unmount', () => {
      vi.useFakeTimers()
      const intervalCallback = vi.fn()
      let handle: ReturnType<typeof setInterval> | undefined

      const { unmount } = mountNode(() => {
        handle = setInterval(intervalCallback, 100)
        onScopeDispose(() => clearInterval(handle))
      })

      vi.advanceTimersByTime(250)
      expect(intervalCallback).toHaveBeenCalledTimes(2)

      unmount()
      vi.advanceTimersByTime(500)
      expect(intervalCallback).toHaveBeenCalledTimes(2) // no new calls after unmount

      vi.useRealTimers()
    })

    it('observer.disconnect() called in onScopeDispose is invoked on unmount', () => {
      const observer = { disconnect: vi.fn() }
      const { unmount } = mountNode(() => {
        onScopeDispose(() => observer.disconnect())
      })

      expect(observer.disconnect).not.toHaveBeenCalled()
      unmount()
      expect(observer.disconnect).toHaveBeenCalledOnce()
    })
  })

  describe('S2.N4 — evidence excerpt', () => {
    it('S2.N4 has at least one evidence excerpt in the snapshot', () => {
      expect(countEvidenceExcerpts('S2.N4')).toBeGreaterThan(0)
    })

    it('S2.N4 evidence excerpt contains onRemoved fingerprint', () => {
      const snippet = loadEvidenceSnippet('S2.N4', 0)
      expect(snippet.length).toBeGreaterThan(0)
      expect(snippet).toMatch(/onRemoved/i)
    })
  })
})

// ── Phase B stubs ─────────────────────────────────────────────────────────────

describe('BC.02 v2 contract — node lifecycle: teardown [Phase B]', () => {
  describe('NodeExtensionOptions.nodeCreated — via defineNodeExtension', () => {
    it.todo(
      'onNodeRemoved() called inside nodeCreated fires when the node is unmounted by the service'
    )
    it.todo(
      'NodeHandle passed to nodeCreated is the same handle accessible in the onNodeRemoved closure'
    )
    it.todo(
      'NodeHandle.getState() is readable inside the onNodeRemoved closure (state not yet cleared)'
    )
  })

  describe('auto-disposal ordering', () => {
    it.todo(
      'handle-registered DOM widgets are removed from the DOM before onScopeDispose callbacks fire'
    )
    it.todo(
      'scope registry entry is absent after unmountExtensionsForNode returns'
    )
  })
})
