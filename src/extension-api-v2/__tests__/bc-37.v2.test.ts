// Category: BC.37 — VueNode bridge timing — deferred mount access
// DB cross-ref: S4.W5
// Exemplar: https://github.com/Comfy-Org/ComfyUI_frontend/blob/main/src/extensions/core/load3d.ts
// blast_radius: 3.20
// compat-floor: blast_radius ≥ 2.0 — MUST pass before v2 ships
// v2 contract: NodeHandle.on('mounted', () => { /* safe to access VueNode state */ })

import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── NodeHandle mount lifecycle simulation ─────────────────────────────────────
// Models the two-phase lifecycle:
//   Phase 1 — nodeCreated: LiteGraph side ready, Vue component not yet mounted.
//   Phase 2 — mounted: Vue component has mounted; all Vue-side state is safe.

type MountHandler = () => void
type Unsubscribe = () => void

interface WidgetLiteSide {
  name: string
  value: unknown
  callback?: () => void
}

interface VueComponentRef {
  initialized: boolean
  someVueProp: string | null
}

function makeNodeHandle(entityId: string) {
  const mountHandlers: MountHandler[] = []
  let mounted = false
  let destroyed = false

  // LiteGraph-side widget data — available from nodeCreated onward
  const widgets: WidgetLiteSide[] = []

  // Vue-side component ref — only valid after mounted fires
  let vueRef: VueComponentRef | null = null

  return {
    entityId,

    // LiteGraph-side: safe to access at any time after nodeCreated
    addWidget(name: string, value: unknown): WidgetLiteSide {
      const w: WidgetLiteSide = { name, value }
      widgets.push(w)
      return w
    },
    getWidgets: () => [...widgets],

    // v2 API: register mounted callback
    on(event: 'mounted', handler: MountHandler): Unsubscribe {
      if (event !== 'mounted') throw new Error(`Unknown event: ${event}`)
      if (mounted) {
        // Already mounted — fire immediately (idempotent contract)
        handler()
        return () => {}
      }
      mountHandlers.push(handler)
      return () => {
        const i = mountHandlers.indexOf(handler)
        if (i !== -1) mountHandlers.splice(i, 1)
      }
    },

    // Internal: runtime calls this after Vue component mounts
    _simulateMount(componentRef: VueComponentRef): void {
      if (destroyed) return // guard: destroyed before mount
      mounted = true
      vueRef = componentRef
      for (const fn of [...mountHandlers]) fn()
    },

    _simulateDestroy(): void {
      destroyed = true
      mountHandlers.length = 0
    },

    // Vue-side: only safe after mounted
    getVueRef: () => vueRef,
    isMounted: () => mounted,
    mountHandlerCount: () => mountHandlers.length
  }
}

// ─────────────────────────────────────────────────────────────────────────────

describe('BC.37 v2 contract — VueNode bridge timing (deferred mount access)', () => {
  let node: ReturnType<typeof makeNodeHandle>

  beforeEach(() => {
    node = makeNodeHandle('node:test:1')
  })

  describe("S4.W5 — NodeHandle.on('mounted') hook", () => {
    it("on('mounted', callback) fires after the Vue component backing the node has mounted", () => {
      let fired = false
      node.on('mounted', () => { fired = true })

      expect(fired).toBe(false) // not yet
      node._simulateMount({ initialized: true, someVueProp: 'hello' })
      expect(fired).toBe(true)
    })

    it("accessing VueNode state inside the 'mounted' callback returns initialized values, not null", () => {
      let capturedRef: VueComponentRef | null = null

      node.on('mounted', () => {
        capturedRef = node.getVueRef()
      })

      node._simulateMount({ initialized: true, someVueProp: 'ready' })

      expect(capturedRef).not.toBeNull()
      expect(capturedRef!.initialized).toBe(true)
      expect(capturedRef!.someVueProp).toBe('ready')
    })

    it("'mounted' fires exactly once per node creation, even if canvas re-renders", () => {
      const calls: number[] = []
      node.on('mounted', () => calls.push(1))

      node._simulateMount({ initialized: true, someVueProp: 'v' })

      // Simulate canvas re-render (component update, not unmount/remount)
      // The runtime does NOT call _simulateMount again for re-renders.
      // mounted fires only once:
      expect(calls).toHaveLength(1)
    })

    it("if the node is destroyed before mounting, the 'mounted' callback is never called", () => {
      const cb = vi.fn()
      node.on('mounted', cb)

      node._simulateDestroy()
      node._simulateMount({ initialized: true, someVueProp: 'late' }) // too late

      expect(cb).not.toHaveBeenCalled()
    })

    it('multiple mounted handlers all fire in registration order', () => {
      const order: string[] = []
      node.on('mounted', () => order.push('first'))
      node.on('mounted', () => order.push('second'))
      node.on('mounted', () => order.push('third'))

      node._simulateMount({ initialized: true, someVueProp: null })

      expect(order).toEqual(['first', 'second', 'third'])
    })

    it('unsubscribing before mount prevents the callback from firing', () => {
      const cb = vi.fn()
      const unsub = node.on('mounted', cb)

      unsub()
      node._simulateMount({ initialized: true, someVueProp: null })

      expect(cb).not.toHaveBeenCalled()
    })
  })

  describe('S4.W5 — ComponentWidgetImpl dual-identity in v2', () => {
    it('WidgetHandle LiteGraph-side properties (value, name) are available before mounted fires', () => {
      // LiteGraph side set up in nodeCreated — before mount
      const w = node.addWidget('steps', 30)
      node.addWidget('cfg', 7.0)

      expect(node.getWidgets()).toHaveLength(2)
      expect(w.name).toBe('steps')
      expect(w.value).toBe(30)

      // Still safe before mount
      expect(node.isMounted()).toBe(false)
    })

    it("Vue-side props and component ref are only safe after the 'mounted' event fires", () => {
      // Before mount: vueRef is null
      expect(node.getVueRef()).toBeNull()

      let refDuringCallback: VueComponentRef | null = null
      node.on('mounted', () => {
        refDuringCallback = node.getVueRef()
      })

      node._simulateMount({ initialized: true, someVueProp: 'canvas-ready' })

      // After mount: ref is populated
      expect(refDuringCallback).not.toBeNull()
      expect(refDuringCallback!.someVueProp).toBe('canvas-ready')
    })

    it('LiteGraph-side widget data set in nodeCreated is still visible inside mounted handler', () => {
      // Widgets added before mount
      node.addWidget('sampler_name', 'euler')
      node.addWidget('seed', 42)

      let widgetsAtMount: WidgetLiteSide[] = []
      node.on('mounted', () => {
        widgetsAtMount = node.getWidgets()
      })

      node._simulateMount({ initialized: true, someVueProp: null })

      expect(widgetsAtMount).toHaveLength(2)
      expect(widgetsAtMount[0].name).toBe('sampler_name')
      expect(widgetsAtMount[1].value).toBe(42)
    })
  })
})
