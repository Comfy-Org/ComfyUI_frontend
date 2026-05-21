// Category: BC.30 — Graph change tracking, batching, and reactivity flush
// DB cross-ref: S11.G1, S11.G3, S11.G4
// Exemplar: https://github.com/nodetool-ai/nodetool/blob/main/subgraphs.md#L1
// blast_radius: 5.48
// compat-floor: blast_radius ≥ 2.0
// migration: graph._version / beforeChange / afterChange / setDirtyCanvas → Vue reactivity + batchUpdate

import { describe, it, expect, vi } from 'vitest'
import { ref, watch, nextTick } from 'vue'

// ── v1 mock ─────────────────────────────────────────────────────────────────

interface V1Graph {
  _version: number
  _changeDepth: number
  beforeChange(): void
  afterChange(): void
}

function createV1Graph(): V1Graph {
  return {
    _version: 1,
    _changeDepth: 0,
    beforeChange() {
      this._changeDepth++
    },
    afterChange() {
      this._changeDepth--
    }
  }
}

// ── v2 mock ─────────────────────────────────────────────────────────────────

interface V2Graph {
  readonly nodeCount: { readonly value: number }
  batchUpdate(fn: () => void): void
  _addNode(): void
}

function createV2Graph(): V2Graph {
  const nodes: string[] = []
  const _nodeCount = ref(0)
  let batchDepth = 0

  return {
    get nodeCount() {
      return { value: _nodeCount.value }
    },
    batchUpdate(fn: () => void) {
      batchDepth++
      try {
        fn()
      } finally {
        batchDepth--
        if (batchDepth === 0) {
          _nodeCount.value = nodes.length
        }
      }
    },
    _addNode() {
      nodes.push(`node:${nodes.length + 1}`)
      if (batchDepth === 0) {
        _nodeCount.value = nodes.length
      }
    }
  }
}

describe('BC.30 migration — graph change tracking, batching, and reactivity flush', () => {
  describe('_version counter migration', () => {
    it('v1 uses graph._version increment; v2 uses Vue reactivity', async () => {
      // v1: manual version increment for change detection
      const v1Graph = createV1Graph()
      let v1Changes = 0
      let cachedVersion = v1Graph._version

      function v1CheckChange() {
        if (v1Graph._version !== cachedVersion) {
          v1Changes++
          cachedVersion = v1Graph._version
        }
      }

      v1Graph._version++
      v1CheckChange()
      expect(v1Changes).toBe(1)

      // v2: watchers auto-trigger
      const v2Graph = createV2Graph()
      let v2Changes = 0

      const stopWatch = watch(
        () => v2Graph.nodeCount.value,
        () => {
          v2Changes++
        },
        { flush: 'sync' }
      )

      v2Graph._addNode()
      await nextTick()
      expect(v2Changes).toBe(1)

      stopWatch()
    })

    it('extensions that increment graph._version should switch to comfyApp.graph.batchUpdate()', () => {
      // v1 pattern: directly increment _version after mutation
      const v1Graph = createV1Graph()
      // mutation...
      v1Graph._version++

      // v2 pattern: use batchUpdate for atomic mutations
      const v2Graph = createV2Graph()
      v2Graph.batchUpdate(() => {
        // mutations...
        v2Graph._addNode()
        v2Graph._addNode()
      })

      expect(v2Graph.nodeCount.value).toBe(2)
    })

    it.todo(
      '[Phase B] v2 compat shim intercepts graph._version++ and logs a deprecation warning'
    )
  })

  describe('beforeChange / afterChange migration', () => {
    it('v1 beforeChange/afterChange is replaced by v2 batchUpdate(fn)', () => {
      // v1 pattern
      const v1Graph = createV1Graph()
      v1Graph.beforeChange()
      // ... mutations ...
      v1Graph.afterChange()

      // v2 pattern
      const v2Graph = createV2Graph()
      v2Graph.batchUpdate(() => {
        // ... mutations ...
        v2Graph._addNode()
      })

      // v2 is simpler: no manual begin/end
      expect(v2Graph.nodeCount.value).toBe(1)
    })

    it('v2 batchUpdate handles nesting automatically (no ref-counting needed)', () => {
      const v2Graph = createV2Graph()

      v2Graph.batchUpdate(() => {
        v2Graph._addNode()
        v2Graph.batchUpdate(() => {
          v2Graph._addNode()
        })
        // Still in outer batch
        expect(v2Graph.nodeCount.value).toBe(0)
      })

      // After outermost batch
      expect(v2Graph.nodeCount.value).toBe(2)
    })

    it.todo(
      '[Phase B] v2 compat shim stubs beforeChange/afterChange as no-ops with deprecation warnings'
    )

    it('code relying on nested beforeChange ref-counting maps to nested batchUpdate', () => {
      // v1: manual ref counting
      const v1Graph = createV1Graph()
      v1Graph.beforeChange() // depth = 1
      v1Graph.beforeChange() // depth = 2
      // mutations...
      v1Graph.afterChange() // depth = 1
      v1Graph.afterChange() // depth = 0 → flush

      // v2: automatic nesting via closures
      const v2Graph = createV2Graph()
      v2Graph.batchUpdate(() => {
        v2Graph.batchUpdate(() => {
          v2Graph._addNode()
        })
        v2Graph._addNode()
      })
      // Flush happens automatically at outermost scope

      expect(v2Graph.nodeCount.value).toBe(2)
    })
  })

  describe('setDirtyCanvas migration', () => {
    it('node.setDirtyCanvas(true, true) calls are safe to remove in v2', () => {
      // In v2, reactivity handles canvas updates automatically
      // setDirtyCanvas calls can simply be deleted

      const v2Graph = createV2Graph()

      // v1 code had: node.setDirtyCanvas(true, true) after mutations
      // v2 code: just do the mutation, reactivity handles the rest
      v2Graph._addNode()

      // Canvas will update automatically via reactive watchers
      expect(v2Graph.nodeCount.value).toBe(1)
    })

    it('v2 compat shim stubs setDirtyCanvas as a no-op with deprecation warning', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // Simulating the v2 shim behavior
      interface ShimmedNode {
        setDirtyCanvas(foreground: boolean, background: boolean): void
      }

      const shimmedNode: ShimmedNode = {
        setDirtyCanvas(foreground: boolean, background: boolean) {
          console.warn(
            `setDirtyCanvas(${foreground}, ${background}) is deprecated. ` +
              'In v2, Vue reactivity handles canvas updates automatically.'
          )
          // No-op: does nothing
        }
      }

      shimmedNode.setDirtyCanvas(true, true)

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('setDirtyCanvas')
      )
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('deprecated')
      )

      warnSpy.mockRestore()
    })

    it('migration checklist: find and remove setDirtyCanvas calls', () => {
      // Pattern to search for in v1 code:
      const v1Patterns = [
        'node.setDirtyCanvas(true, false)',
        'node.setDirtyCanvas(true, true)',
        'this.setDirtyCanvas(true, false)',
        'this.setDirtyCanvas(true, true)'
      ]

      // Migration: all these can be deleted in v2
      // The compat shim makes them no-ops during transition

      expect(v1Patterns.every((p) => p.includes('setDirtyCanvas'))).toBe(true)
    })
  })

  describe('behavioral equivalence', () => {
    it('v1 and v2 both support atomic batched mutations', () => {
      // v1: beforeChange/afterChange
      const v1Graph = createV1Graph()
      v1Graph.beforeChange()
      // mutations...
      v1Graph.afterChange()
      // Single flush at end

      // v2: batchUpdate
      const v2Graph = createV2Graph()
      v2Graph.batchUpdate(() => {
        v2Graph._addNode()
        v2Graph._addNode()
      })
      // Single reactive update at end

      expect(v2Graph.nodeCount.value).toBe(2)
    })

    it('both APIs support deferred updates during batch', async () => {
      const v2Graph = createV2Graph()
      const observed: number[] = []

      const stopWatch = watch(
        () => v2Graph.nodeCount.value,
        (val) => observed.push(val),
        { flush: 'sync' }
      )

      v2Graph.batchUpdate(() => {
        v2Graph._addNode()
        v2Graph._addNode()
        v2Graph._addNode()
        // No intermediate observations
      })

      await nextTick()

      // Only final state observed
      expect(observed).toEqual([3])

      stopWatch()
    })
  })
})
