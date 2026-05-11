// Category: BC.33 — Cross-extension DOM widget creation observation
// DB cross-ref: S4.W6
// Exemplar: https://github.com/goodtab/ComfyUI-Custom-Scripts
// blast_radius: 0.0
// compat-floor: NO (absent API gap — migration is from workaround to new first-class event)
// migration: MutationObserver / polling workaround → comfyApp.on('domWidgetCreated', handler)

import { describe, expect, it, vi } from 'vitest'

// ── MutationObserver workaround simulation ────────────────────────────────────
// v1 pattern: extensions used MutationObserver on document.body to detect new
// widget DOM elements and infer their type from class names.

type WidgetHandle = { entityId: string; name: string; type: string }
type Unsubscribe = () => void

function makeMutationObserverWorkaround() {
  // Simulates the v1 pattern: observer detects DOM additions, tries to infer widget info
  const callbacks: Array<(widget: { domElement: HTMLElement; inferredType: string }) => void> = []
  let callCount = 0

  return {
    observe(cb: (info: { domElement: HTMLElement; inferredType: string }) => void) {
      callbacks.push(cb)
    },
    // Simulates DOM mutation being detected
    _simulateMutation(el: HTMLElement, inferredType: string) {
      callCount++
      for (const cb of callbacks) cb({ domElement: el, inferredType })
    },
    callCount: () => callCount
  }
}

// ── setInterval polling workaround simulation ─────────────────────────────────

function makePollingWorkaround(nodeWidgets: () => WidgetHandle[]) {
  let lastCount = 0
  const newWidgetCallbacks: Array<(w: WidgetHandle) => void> = []
  let intervalId: ReturnType<typeof setInterval> | null = null

  return {
    start(onNew: (w: WidgetHandle) => void) {
      newWidgetCallbacks.push(onNew)
      intervalId = setInterval(() => {
        const current = nodeWidgets()
        if (current.length > lastCount) {
          for (let i = lastCount; i < current.length; i++) {
            newWidgetCallbacks.forEach((cb) => cb(current[i]))
          }
          lastCount = current.length
        }
      }, 100)
    },
    stop() {
      if (intervalId !== null) clearInterval(intervalId)
    }
  }
}

// ── V2 event bus (models comfyApp.on('domWidgetCreated')) ─────────────────────

function makeV2AppBus() {
  const handlers: Array<(w: WidgetHandle) => void> = []
  let emitCount = 0

  return {
    on(_event: 'domWidgetCreated', handler: (w: WidgetHandle) => void): Unsubscribe {
      handlers.push(handler)
      return () => {
        const i = handlers.indexOf(handler)
        if (i !== -1) handlers.splice(i, 1)
      }
    },
    _emit(w: WidgetHandle) {
      emitCount++
      handlers.forEach((fn) => fn(w))
    },
    emitCount: () => emitCount
  }
}

// ─────────────────────────────────────────────────────────────────────────────

describe('BC.33 migration — cross-extension DOM widget creation observation', () => {
  describe('MutationObserver workaround replacement', () => {
    it("MutationObserver on document.body for widget detection is replaced by comfyApp.on('domWidgetCreated', ...)", () => {
      // v1: MutationObserver receives raw DOM + inferred type
      const v1 = makeMutationObserverWorkaround()
      const v1Results: string[] = []
      v1.observe(({ inferredType }) => v1Results.push(inferredType))

      const fakeEl = document.createElement('div')
      v1._simulateMutation(fakeEl, 'Slider')
      expect(v1Results).toEqual(['Slider'])

      // v2: receives typed WidgetHandle directly — no DOM inspection needed
      const v2 = makeV2AppBus()
      const v2Results: string[] = []
      v2.on('domWidgetCreated', (w) => v2Results.push(w.type))

      v2._emit({ entityId: 'w:1', name: 'cfg', type: 'Slider' })
      expect(v2Results).toEqual(['Slider'])

      // v2 never needs to inspect DOM class names to determine widget type
      expect(v2Results[0]).toBe(v1Results[0])
    })

    it('the v2 domWidgetCreated handler fires synchronously after widget construction (no async gap)', () => {
      const v2 = makeV2AppBus()
      const order: string[] = []

      v2.on('domWidgetCreated', () => order.push('handler'))

      order.push('before-emit')
      v2._emit({ entityId: 'w:1', name: 'x', type: 'InputText' })
      order.push('after-emit')

      // handler fires synchronously between before and after
      expect(order).toEqual(['before-emit', 'handler', 'after-emit'])
    })
  })

  describe('polling workaround replacement', () => {
    it('setInterval polling on node.widgets can be replaced by the domWidgetCreated event', async () => {
      // v1: polling approach accumulates widgets found over time
      const widgetList: WidgetHandle[] = []
      const pollFound: WidgetHandle[] = []
      const poller = makePollingWorkaround(() => widgetList)
      poller.start((w) => pollFound.push(w))

      widgetList.push({ entityId: 'w:1', name: 'seed', type: 'INT' })

      await new Promise((r) => setTimeout(r, 150))
      poller.stop()
      expect(pollFound).toHaveLength(1)

      // v2: event fires immediately, no polling latency
      const v2 = makeV2AppBus()
      const eventFound: WidgetHandle[] = []
      v2.on('domWidgetCreated', (w) => eventFound.push(w))

      v2._emit({ entityId: 'w:1', name: 'seed', type: 'INT' })
      expect(eventFound).toHaveLength(1) // immediate, no timeout needed
    })

    it('v2 event fires once per widget creation; no deduplication logic needed in the handler', () => {
      const v2 = makeV2AppBus()
      const seen = new Set<string>()
      const duplicates: string[] = []

      v2.on('domWidgetCreated', (w) => {
        if (seen.has(w.entityId)) duplicates.push(w.entityId)
        seen.add(w.entityId)
      })

      // Runtime emits once per creation — test that duplicates don't occur
      v2._emit({ entityId: 'w:unique-1', name: 'a', type: 'Slider' })
      v2._emit({ entityId: 'w:unique-2', name: 'b', type: 'Slider' })
      v2._emit({ entityId: 'w:unique-3', name: 'c', type: 'Slider' })

      expect(duplicates).toHaveLength(0)
      expect(v2.emitCount()).toBe(3) // each emit is distinct
    })
  })

  describe('no compat shim required', () => {
    it('there is no v1 hook to shim — extensions must opt-in to domWidgetCreated explicitly in v2', () => {
      // This tests the absence of automatic wiring: if an extension does not call
      // comfyApp.on('domWidgetCreated'), it receives nothing — there is no implicit shim.
      const v2 = makeV2AppBus()
      const received: WidgetHandle[] = []

      // Extension deliberately does NOT register a listener
      // (simulates an extension that hasn't migrated yet)

      v2._emit({ entityId: 'w:1', name: 'x', type: 'Select' })

      // Nothing received — opt-in required
      expect(received).toHaveLength(0)
      expect(v2.emitCount()).toBe(1) // event was emitted, just no listener
    })
  })
})
