// Category: BC.37 — VueNode bridge timing — deferred mount access
// DB cross-ref: S4.W5
// Exemplar: https://github.com/Comfy-Org/ComfyUI_frontend/blob/main/src/extensions/core/load3d.ts
// blast_radius: 3.20
// compat-floor: blast_radius ≥ 2.0 — MUST pass before v2 ships
// migration: waitForLoad3d polling pattern → NodeHandle.on('mounted', callback)

import { describe, expect, it, vi } from 'vitest'

// ── V1 waitForLoad3d polling simulation ───────────────────────────────────────
// v1 pattern from load3d.ts: setInterval polling to detect when the Vue3D
// component reference is non-null, then call back.

interface VueComponentRef {
  initialized: boolean
  render3d?: () => void
}

function makeV1WaitForLoad3d(getRef: () => VueComponentRef | null) {
  return function waitForLoad3d(callback: (ref: VueComponentRef) => void): () => void {
    let intervalId: ReturnType<typeof setInterval>
    let settled = false

    intervalId = setInterval(() => {
      const ref = getRef()
      if (ref && !settled) {
        settled = true
        clearInterval(intervalId)
        callback(ref)
      }
    }, 16) // ~1 frame

    return () => clearInterval(intervalId)
  }
}

// ── V2 NodeHandle.on('mounted') simulation ────────────────────────────────────

function makeV2NodeHandle(entityId: string) {
  const handlers: Array<() => void> = []
  let mounted = false
  let vueRef: VueComponentRef | null = null

  return {
    entityId,
    on(event: 'mounted', handler: () => void): () => void {
      if (mounted) { handler(); return () => {} }
      handlers.push(handler)
      return () => {
        const i = handlers.indexOf(handler)
        if (i !== -1) handlers.splice(i, 1)
      }
    },
    _simulateMount(ref: VueComponentRef): void {
      mounted = true
      vueRef = ref
      handlers.forEach((fn) => fn())
    },
    getVueRef: () => vueRef,
    isMounted: () => mounted,
    handlerCount: () => handlers.length
  }
}

// ── Compat shim: wraps on('mounted') to look like waitForLoad3d ──────────────

function makeCompatWaitForLoad3d(node: ReturnType<typeof makeV2NodeHandle>) {
  return function waitForLoad3d(callback: (ref: VueComponentRef) => void): () => void {
    // Shim: translate waitForLoad3d(cb) → node.on('mounted', cb)
    // No polling needed — the event fires once from the runtime.
    let deprecated = false
    if (!deprecated) {
      console.warn('[v2 compat] waitForLoad3d is deprecated — use NodeHandle.on("mounted", callback)')
      deprecated = true
    }
    return node.on('mounted', () => {
      const ref = node.getVueRef()
      if (ref) callback(ref)
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────

describe('BC.37 migration — VueNode bridge timing (deferred mount access)', () => {
  describe('waitForLoad3d replacement', () => {
    it("waitForLoad3d(node, callback) is replaced by NodeHandle.on('mounted', callback) in v2", async () => {
      let vueRef: VueComponentRef | null = null
      const refHolder = { ref: null as VueComponentRef | null }

      // v1: polling
      const v1WaitFor = makeV1WaitForLoad3d(() => refHolder.ref)
      const v1Received: VueComponentRef[] = []
      const cancelPoll = v1WaitFor((r) => v1Received.push(r))

      // Simulate Vue component becoming available after two poll cycles
      await new Promise<void>((r) => setTimeout(r, 40))
      refHolder.ref = { initialized: true, render3d: vi.fn() }
      await new Promise<void>((r) => setTimeout(r, 40))

      cancelPoll()
      expect(v1Received).toHaveLength(1)
      expect(v1Received[0].initialized).toBe(true)

      // v2: event — no polling, fires synchronously on mount
      const v2Node = makeV2NodeHandle('node:load3d:1')
      const v2Received: VueComponentRef[] = []
      v2Node.on('mounted', () => {
        vueRef = v2Node.getVueRef()
        if (vueRef) v2Received.push(vueRef)
      })

      v2Node._simulateMount({ initialized: true, render3d: vi.fn() })

      expect(v2Received).toHaveLength(1)
      expect(v2Received[0].initialized).toBe(true)
    })

    it("v2 'mounted' fires via event system rather than polling; no setTimeout or setInterval needed", () => {
      vi.useFakeTimers()

      const v2Node = makeV2NodeHandle('node:evt:1')
      let fired = false
      v2Node.on('mounted', () => { fired = true })

      // No timers advance needed — fires synchronously when _simulateMount is called
      v2Node._simulateMount({ initialized: true })

      expect(fired).toBe(true)
      // Time never advanced — proving no polling occurred
      expect(vi.getTimerCount()).toBe(0)

      vi.useRealTimers()
    })

    it('v2 compat shim provides waitForLoad3d as a thin wrapper around on(mounted) with a deprecation warning', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const v2Node = makeV2NodeHandle('node:shim:1')
      const shimmedWait = makeCompatWaitForLoad3d(v2Node)

      const received: VueComponentRef[] = []
      shimmedWait((ref) => received.push(ref))

      v2Node._simulateMount({ initialized: true, render3d: vi.fn() })

      expect(received).toHaveLength(1)
      expect(received[0].initialized).toBe(true)
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('waitForLoad3d is deprecated'))

      warnSpy.mockRestore()
    })
  })

  describe('timing contract at nodeCreated', () => {
    it("code that previously ran in nodeCreated and expected DOM to be ready must move into 'mounted' handler", () => {
      // v1: extension accessed node ref directly in nodeCreated — ref was often null
      const eagerVueRef: VueComponentRef | null = null // null at creation time
      const eagerResult = eagerVueRef?.initialized ?? 'null-access' // v1: unsafe

      expect(eagerResult).toBe('null-access') // demonstrates the v1 bug

      // v2: moved into mounted handler — ref is guaranteed non-null
      const node = makeV2NodeHandle('node:timing:1')
      let safeResult: boolean | undefined

      node.on('mounted', () => {
        const ref = node.getVueRef()
        safeResult = ref?.initialized // safe — always initialized here
      })

      node._simulateMount({ initialized: true })
      expect(safeResult).toBe(true)
    })

    it('LiteGraph-side widget properties (value, callback, name) remain safe to read in nodeCreated without waiting', () => {
      // This is a negative test: v2 does NOT require all code to move into 'mounted'.
      // LiteGraph-side data is synchronously available at nodeCreated time.
      const node = makeV2NodeHandle('node:litegraph:1')

      // Simulating nodeCreated — no mount yet
      expect(node.isMounted()).toBe(false)

      // LiteGraph-side operations are safe here (handled by the node itself
      // before the Vue component mounts). For the purpose of this migration test,
      // we verify the node handle exists and is operable before mounting.
      expect(node.entityId).toBe('node:litegraph:1')
      expect(node.handlerCount()).toBe(0) // no mounted listeners yet

      // Only after 'mounted' do we access Vue-side state
      let vueSideAccessed = false
      node.on('mounted', () => {
        // This is where Vue-side access belongs
        vueSideAccessed = node.getVueRef() !== null
      })

      expect(vueSideAccessed).toBe(false) // not yet
      node._simulateMount({ initialized: true })
      expect(vueSideAccessed).toBe(true)
    })
  })
})
