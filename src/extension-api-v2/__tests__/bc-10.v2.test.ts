// Category: BC.10 — Widget value subscription
// DB cross-ref: S4.W1, S2.N14
// Exemplar: https://github.com/Comfy-Org/ComfyUI_frontend/blob/main/src/extensions/core/widgetInputs.ts#L317
// blast_radius: 5.09 — compat-floor: blast_radius ≥ 2.0 — MUST pass before v2 ships
// v2 replacement: widget.on('valueChange', fn) — NOTE: event name is 'valueChange' not 'change'
//
// Harness model:
//   createMockWidgetHandle() builds a minimal WidgetHandle-shaped object backed by
//   a Vue shallowRef. Calling .setValue(v) updates the ref and notifies all
//   'valueChange' listeners synchronously (same tick). This proves the event
//   contract without requiring the full ECS world (Phase B).
//
// S2.N14 note: NodeHandle.on('widgetChanged') does NOT exist in the v2 API.
//   The v2 replacement for per-node widget observation is per-widget
//   widget.on('valueChange'). Tests below reflect the real API surface.

import { shallowRef } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WidgetValueChangeEvent } from '@/extension-api/widget'
import type { Unsubscribe } from '@/extension-api/events'

// ── Minimal mock WidgetHandle ─────────────────────────────────────────────────

interface MockWidgetHandle {
  name: string
  getValue<T = unknown>(): T
  setValue(value: unknown): void
  on(event: 'valueChange', handler: (e: WidgetValueChangeEvent) => void): Unsubscribe
}

function createMockWidgetHandle(name: string, initial: unknown = ''): MockWidgetHandle {
  const valueRef = shallowRef(initial)
  const listeners: Array<(e: WidgetValueChangeEvent) => void> = []

  return {
    name,
    getValue<T>() { return valueRef.value as T },
    setValue(newValue: unknown) {
      const oldValue = valueRef.value
      if (newValue === oldValue) return
      valueRef.value = newValue
      const event: WidgetValueChangeEvent = { newValue, oldValue }
      for (const fn of listeners) fn(event)
    },
    on(_event: 'valueChange', handler: (e: WidgetValueChangeEvent) => void): Unsubscribe {
      listeners.push(handler)
      return () => {
        const idx = listeners.indexOf(handler)
        if (idx !== -1) listeners.splice(idx, 1)
      }
    }
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BC.10 v2 contract — widget value subscription', () => {
  describe("widget.on('valueChange', fn) — per-widget subscription (S4.W1 replacement)", () => {
    it("on('valueChange') fires with {newValue, oldValue} when setValue is called", () => {
      const widget = createMockWidgetHandle('steps', 20)
      const handler = vi.fn()

      widget.on('valueChange', handler)
      widget.setValue(30)

      expect(handler).toHaveBeenCalledOnce()
      expect(handler).toHaveBeenCalledWith({ newValue: 30, oldValue: 20 })
    })

    it('handler receives the correct oldValue even after multiple sequential changes', () => {
      const widget = createMockWidgetHandle('seed', 0)
      const received: WidgetValueChangeEvent[] = []

      widget.on('valueChange', (e) => received.push(e))
      widget.setValue(1)
      widget.setValue(2)
      widget.setValue(3)

      expect(received).toHaveLength(3)
      expect(received[0]).toEqual({ newValue: 1, oldValue: 0 })
      expect(received[1]).toEqual({ newValue: 2, oldValue: 1 })
      expect(received[2]).toEqual({ newValue: 3, oldValue: 2 })
    })

    it('multiple listeners on the same widget are all invoked in registration order', () => {
      const widget = createMockWidgetHandle('cfg', 7)
      const order: string[] = []

      widget.on('valueChange', () => order.push('first'))
      widget.on('valueChange', () => order.push('second'))
      widget.on('valueChange', () => order.push('third'))
      widget.setValue(8)

      expect(order).toEqual(['first', 'second', 'third'])
    })

    it('unsubscribe return value removes the listener; subsequent changes do not invoke it', () => {
      const widget = createMockWidgetHandle('sampler', 'euler')
      const handler = vi.fn()

      const unsubscribe = widget.on('valueChange', handler)
      widget.setValue('dpm')
      expect(handler).toHaveBeenCalledOnce()

      unsubscribe()
      widget.setValue('euler_a')
      // Still only one call — handler was removed.
      expect(handler).toHaveBeenCalledOnce()
    })

    it('unsubscribing one listener does not affect other listeners on the same widget', () => {
      const widget = createMockWidgetHandle('steps', 10)
      const removed = vi.fn()
      const kept = vi.fn()

      const unsub = widget.on('valueChange', removed)
      widget.on('valueChange', kept)

      unsub()
      widget.setValue(20)

      expect(removed).not.toHaveBeenCalled()
      expect(kept).toHaveBeenCalledOnce()
    })

    it('handler does not fire when setValue is called with the same value (no-op change)', () => {
      const widget = createMockWidgetHandle('denoise', 1.0)
      const handler = vi.fn()

      widget.on('valueChange', handler)
      widget.setValue(1.0) // same value — should not fire

      expect(handler).not.toHaveBeenCalled()
    })

    it('getValue() returns the current value after setValue', () => {
      const widget = createMockWidgetHandle('prompt', 'hello')
      widget.setValue('world')
      expect(widget.getValue()).toBe('world')
    })
  })

  describe('v2 API surface notes — S2.N14', () => {
    // S2.N14 (onWidgetChanged) has no NodeHandle.on('widgetChanged') equivalent.
    // The v2 replacement is per-widget widget.on('valueChange') subscriptions.
    // A node-level "any widget changed" event is not in the v2 API surface.

    it('all widgets on a node can be independently observed via per-widget subscriptions', () => {
      const widgetA = createMockWidgetHandle('steps', 20)
      const widgetB = createMockWidgetHandle('cfg', 7.0)
      const nodeChanges: string[] = []

      // v2: subscribe to each widget individually (replaces onWidgetChanged)
      widgetA.on('valueChange', (e) => nodeChanges.push(`steps:${e.newValue}`))
      widgetB.on('valueChange', (e) => nodeChanges.push(`cfg:${e.newValue}`))

      widgetA.setValue(25)
      widgetB.setValue(8.0)
      widgetA.setValue(30)

      expect(nodeChanges).toEqual(['steps:25', 'cfg:8', 'steps:30'])
    })

    it('unsubscribing from one widget does not affect observation of sibling widgets', () => {
      const widgetA = createMockWidgetHandle('steps', 20)
      const widgetB = createMockWidgetHandle('cfg', 7.0)
      const handlerA = vi.fn()
      const handlerB = vi.fn()

      const unsubA = widgetA.on('valueChange', handlerA)
      widgetB.on('valueChange', handlerB)

      unsubA()
      widgetA.setValue(25)
      widgetB.setValue(8.0)

      expect(handlerA).not.toHaveBeenCalled()
      expect(handlerB).toHaveBeenCalledOnce()
    })
  })
})
