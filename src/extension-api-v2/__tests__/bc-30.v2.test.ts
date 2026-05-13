// Category: BC.30 — Graph change tracking, batching, and reactivity flush
// DB cross-ref: S11.G1, S11.G3, S11.G4
// Exemplar: https://github.com/nodetool-ai/nodetool/blob/main/subgraphs.md#L1
// blast_radius: 5.48
// compat-floor: blast_radius ≥ 2.0
// v2 contract: Vue reactivity replaces graph._version; comfyApp.graph.batchUpdate(fn) replaces
//              beforeChange/afterChange; setDirtyCanvas is implicit

import { describe, it, expect, vi } from 'vitest'
import { ref, watch, nextTick } from 'vue'

// ── v2 GraphHandle mock with Vue reactivity ─────────────────────────────────
// Phase B will provide the real ECS-backed implementation.

interface ReactiveGraphHandle {
  /** Reactive node count — watchers auto-trigger on add/remove */
  readonly nodeCount: { readonly value: number }

  /** Add a node (triggers reactivity) */
  addNode(opts: { type: string }): { entityId: string; type: string }

  /** Remove a node (triggers reactivity) */
  removeNode(handle: { entityId: string }): void

  /** Batch multiple mutations — watchers only see final state */
  batchUpdate(fn: () => void): void
}

function createReactiveGraphHandle(): ReactiveGraphHandle {
  const nodes = new Map<string, { entityId: string; type: string }>()
  const _nodeCount = ref(0)
  let batchDepth = 0
  let nextId = 1

  return {
    get nodeCount() {
      return { value: _nodeCount.value }
    },

    addNode(opts: { type: string }) {
      const handle = { entityId: `node:${nextId++}`, type: opts.type }
      nodes.set(handle.entityId, handle)
      if (batchDepth === 0) {
        _nodeCount.value = nodes.size
      }
      return handle
    },

    removeNode(handle: { entityId: string }) {
      nodes.delete(handle.entityId)
      if (batchDepth === 0) {
        _nodeCount.value = nodes.size
      }
    },

    batchUpdate(fn: () => void) {
      batchDepth++
      try {
        fn()
      } finally {
        batchDepth--
        if (batchDepth === 0) {
          _nodeCount.value = nodes.size
        }
      }
    }
  }
}

describe('BC.30 v2 contract — graph change tracking, batching, and reactivity flush', () => {
  describe('S11.G1 — reactive graph state replaces _version', () => {
    it('graph state is Vue-reactive; watchers auto-trigger on add/remove', async () => {
      const graph = createReactiveGraphHandle()
      const changes: number[] = []

      // Set up a Vue watcher
      const nodeCountRef = ref(graph.nodeCount.value)
      const stopWatch = watch(
        () => graph.nodeCount.value,
        (newVal) => {
          nodeCountRef.value = newVal
          changes.push(newVal)
        },
        { flush: 'sync' }
      )

      graph.addNode({ type: 'TestNode' })
      await nextTick()

      expect(changes).toContain(1)

      graph.addNode({ type: 'TestNode2' })
      await nextTick()

      expect(changes).toContain(2)

      stopWatch()
    })

    it('graph._version does not exist on the v2 GraphHandle', () => {
      const graph = createReactiveGraphHandle() as unknown as {
        _version?: number
      }

      expect(graph._version).toBeUndefined()
    })

    it('comfyApp.graph exposes a reactive nodeCount property', () => {
      const graph = createReactiveGraphHandle()

      expect(graph.nodeCount.value).toBe(0)

      graph.addNode({ type: 'TestNode' })
      expect(graph.nodeCount.value).toBe(1)

      graph.addNode({ type: 'TestNode' })
      expect(graph.nodeCount.value).toBe(2)
    })

    it('nodeCount updates automatically when nodes are removed', () => {
      const graph = createReactiveGraphHandle()

      const node = graph.addNode({ type: 'TestNode' })
      expect(graph.nodeCount.value).toBe(1)

      graph.removeNode(node)
      expect(graph.nodeCount.value).toBe(0)
    })
  })

  describe('S11.G3 — batchUpdate replaces beforeChange/afterChange', () => {
    it('comfyApp.graph.batchUpdate(fn) defers all reactive updates until fn completes', async () => {
      const graph = createReactiveGraphHandle()
      const observedCounts: number[] = []

      const stopWatch = watch(
        () => graph.nodeCount.value,
        (val) => observedCounts.push(val),
        { flush: 'sync' }
      )

      graph.batchUpdate(() => {
        graph.addNode({ type: 'Node1' })
        graph.addNode({ type: 'Node2' })
        graph.addNode({ type: 'Node3' })
        // Inside batch: no intermediate updates fired
      })

      await nextTick()

      // Only final state observed (3 nodes)
      expect(observedCounts).toEqual([3])

      stopWatch()
    })

    it('mutations inside batchUpdate are committed atomically', () => {
      const graph = createReactiveGraphHandle()

      graph.batchUpdate(() => {
        graph.addNode({ type: 'Node1' })
        // Mid-batch: nodeCount is not yet updated externally
        expect(graph.nodeCount.value).toBe(0) // Deferred
        graph.addNode({ type: 'Node2' })
      })

      // After batch: all mutations visible
      expect(graph.nodeCount.value).toBe(2)
    })

    it('nested batchUpdate calls work correctly', () => {
      const graph = createReactiveGraphHandle()

      graph.batchUpdate(() => {
        graph.addNode({ type: 'Outer1' })

        graph.batchUpdate(() => {
          graph.addNode({ type: 'Inner1' })
          graph.addNode({ type: 'Inner2' })
        })

        // Still inside outer batch
        expect(graph.nodeCount.value).toBe(0)
      })

      // After outermost batch completes
      expect(graph.nodeCount.value).toBe(3)
    })

    it.todo(
      '[Phase B] exceptions thrown inside batchUpdate cause the batch to be rolled back'
    )
  })

  describe('S11.G4 — implicit canvas flush', () => {
    it('setDirtyCanvas is not needed in v2 — reactivity handles repaints', () => {
      // In v2, the render loop watches reactive graph state
      // No manual setDirtyCanvas calls required

      const graph = createReactiveGraphHandle()

      // Adding a node automatically triggers reactive updates
      // which the render loop observes
      graph.addNode({ type: 'TestNode' })

      // No setDirtyCanvas call needed
      expect(graph.nodeCount.value).toBe(1)
    })

    it('calling node.setDirtyCanvas in v2 is a no-op shim', () => {
      // Type-level: NodeHandle in v2 may have setDirtyCanvas as deprecated shim
      interface DeprecatedNodeHandle {
        /** @deprecated v2 reactivity handles canvas updates automatically */
        setDirtyCanvas?(foreground: boolean, background: boolean): void
      }

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const shimNode: DeprecatedNodeHandle = {
        setDirtyCanvas(foreground: boolean, background: boolean) {
          console.warn(
            `setDirtyCanvas(${foreground}, ${background}) is deprecated in v2 — reactivity handles this automatically`
          )
          // No-op: the call does nothing
        }
      }

      shimNode.setDirtyCanvas?.(true, true)

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('setDirtyCanvas')
      )

      warnSpy.mockRestore()
    })

    it.todo('[Phase B] setDirtyCanvas shim is wired into NodeHandle at runtime')
  })
})
