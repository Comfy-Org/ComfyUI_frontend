// Category: BC.10 — Widget value subscription
// DB cross-ref: S4.W1, S2.N14
// Exemplar: https://github.com/Comfy-Org/ComfyUI_frontend/blob/main/src/extensions/core/widgetInputs.ts#L317
// Migration: v1 widget.callback chain-patching / node.onWidgetChanged
//            → v2 widget.on('valueChange', fn)
//
// Key migration facts:
//   1. v1 event name: (no named event — direct callback assignment)
//      v2 event name: 'valueChange' (NOT 'change')
//   2. v1 payload: positional args (value, app, node, pos, event)
//      v2 payload: typed object { newValue, oldValue }
//   3. v1 S2.N14 (node.onWidgetChanged) has no direct v2 equivalent.
//      Migration: subscribe per-widget via widget.on('valueChange').
//   4. v1 and v2 listeners operate independently; both fire for the same
//      logical change in a mixed-mode (parallel-paths) app (D6 Phase A).

import { shallowRef } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type { WidgetValueChangeEvent } from '@/extension-api/widget'
import type { Unsubscribe } from '@/extension-api/events'

// ── Shared mock: one widget object that supports BOTH v1 and v2 subscriptions ─
// Models the parallel-paths Phase A world where both v1 and v2 extensions
// are active on the same widget simultaneously (D6).

interface V1Widget {
  name: string
  value: unknown
  callback?: (value: unknown, app?: unknown, node?: unknown) => void
}

interface MockWidgetHandle {
  name: string
  getValue<T = unknown>(): T
  setValue(value: unknown): void
  on(event: 'valueChange', handler: (e: WidgetValueChangeEvent) => void): Unsubscribe
}

function createDualWidget(name: string, initial: unknown = '') {
  const valueRef = shallowRef(initial)
  const v2Listeners: Array<(e: WidgetValueChangeEvent) => void> = []

  // v1 shape
  const v1: V1Widget = { name, value: initial }

  // v2 shape
  const v2: MockWidgetHandle = {
    name,
    getValue<T>() { return valueRef.value as T },
    setValue(newValue: unknown) {
      const oldValue = valueRef.value
      if (newValue === oldValue) return
      valueRef.value = newValue
      v1.value = newValue
      // Fire v2 listeners
      const event: WidgetValueChangeEvent = { newValue, oldValue }
      for (const fn of v2Listeners) fn(event)
    },
    on(_event: 'valueChange', handler: (e: WidgetValueChangeEvent) => void): Unsubscribe {
      v2Listeners.push(handler)
      return () => {
        const idx = v2Listeners.indexOf(handler)
        if (idx !== -1) v2Listeners.splice(idx, 1)
      }
    }
  }

  // Simulate LiteGraph calling v1 callback (Phase A: explicit in tests)
  function simulateV1Change(newValue: unknown, node?: unknown): void {
    const old = v1.value
    v1.value = newValue
    v1.callback?.(newValue, undefined, node)
    // In Phase A the v1 and v2 paths are separate; v2.setValue must be called
    // explicitly to trigger v2 listeners. In production (post-Phase B) the
    // reactive bridge will do this automatically.
    v2.setValue(newValue)
    void old
  }

  return { v1, v2, simulateV1Change }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BC.10 migration — widget value subscription', () => {
  describe('widget.callback → widget.on(\'valueChange\') — payload shape migration (S4.W1)', () => {
    it('v1 callback and v2 valueChange handler both fire with the new value for the same interaction', () => {
      const { v1, v2, simulateV1Change } = createDualWidget('steps', 20)
      const v1Received: unknown[] = []
      const v2Received: WidgetValueChangeEvent[] = []

      v1.callback = (val) => v1Received.push(val)
      v2.on('valueChange', (e) => v2Received.push(e))

      simulateV1Change(30)

      expect(v1Received).toEqual([30])
      expect(v2Received).toHaveLength(1)
      expect(v2Received[0].newValue).toBe(30)
    })

    it('v2 payload is { newValue, oldValue } — v1 payload is positional args; both carry the same new value', () => {
      const { v1, v2, simulateV1Change } = createDualWidget('cfg', 7)
      let v1Value: unknown
      let v2Event: WidgetValueChangeEvent | undefined

      v1.callback = (val) => { v1Value = val }
      v2.on('valueChange', (e) => { v2Event = e })

      simulateV1Change(8)

      // v1: first positional arg is the new value
      expect(v1Value).toBe(8)
      // v2: named object with both new and old
      expect(v2Event).toEqual({ newValue: 8, oldValue: 7 })
    })

    it("v2 event is named 'valueChange' — the v1 pattern has no event name (direct callback assign)", () => {
      // Documenting the migration: the v2 string literal is 'valueChange', not 'change'.
      // Extension authors migrating from v1 must use the correct name.
      const { v2 } = createDualWidget('sampler', 'euler')
      const handler = vi.fn()

      // Correct v2 event name:
      v2.on('valueChange', handler)
      v2.setValue('dpm')
      expect(handler).toHaveBeenCalledOnce()
    })

    it('v1 chain-patching and v2 on(\'valueChange\') do not interfere: each operates independently', () => {
      const { v1, v2, simulateV1Change } = createDualWidget('seed', 0)
      const v1Order: string[] = []
      const v2Order: string[] = []

      // v1: chain-patch
      const orig = v1.callback
      v1.callback = function (val, a, n) {
        v1Order.push('v1-outer')
        orig?.call(this, val, a, n)
      }
      // v2: independent subscription
      v2.on('valueChange', () => v2Order.push('v2-listener'))

      simulateV1Change(1)

      expect(v1Order).toEqual(['v1-outer'])
      expect(v2Order).toEqual(['v2-listener'])
    })
  })

  describe('node.onWidgetChanged → per-widget on(\'valueChange\') — S2.N14 migration', () => {
    it('v1 onWidgetChanged and v2 per-widget valueChange both fire for the same widget change', () => {
      const { v1, v2, simulateV1Change } = createDualWidget('steps', 20)
      const v1NodeCalls: Array<{ name: string; value: unknown }> = []
      const v2Calls: WidgetValueChangeEvent[] = []

      const node = {
        onWidgetChanged: (name: string, value: unknown) => v1NodeCalls.push({ name, value })
      }

      // v1: node-level subscription (fires at the node level)
      v1.callback = (val) => { node.onWidgetChanged(v1.name, val) }
      // v2: per-widget subscription
      v2.on('valueChange', (e) => v2Calls.push(e))

      simulateV1Change(30)

      expect(v1NodeCalls).toHaveLength(1)
      expect(v1NodeCalls[0]).toEqual({ name: 'steps', value: 30 })
      expect(v2Calls).toHaveLength(1)
      expect(v2Calls[0].newValue).toBe(30)
    })

    it('v2 migration: observe all widgets on a node via per-widget subscriptions (replaces single onWidgetChanged)', () => {
      const stepW = createDualWidget('steps', 20)
      const cfgW = createDualWidget('cfg', 7.0)
      const nodeChanges: Array<{ name: string; newValue: unknown }> = []

      // v2 migration: subscribe individually — no single node-level event
      stepW.v2.on('valueChange', (e) => nodeChanges.push({ name: 'steps', newValue: e.newValue }))
      cfgW.v2.on('valueChange', (e) => nodeChanges.push({ name: 'cfg', newValue: e.newValue }))

      stepW.v2.setValue(25)
      cfgW.v2.setValue(8.0)

      expect(nodeChanges).toEqual([
        { name: 'steps', newValue: 25 },
        { name: 'cfg', newValue: 8.0 }
      ])
    })
  })

  describe('scope disposal isolation', () => {
    it('disposing one extension\'s listener does not remove another extension\'s listener on the same widget', () => {
      const { v2 } = createDualWidget('steps', 20)
      const ext1 = vi.fn()
      const ext2 = vi.fn()

      const unsub1 = v2.on('valueChange', ext1)
      v2.on('valueChange', ext2)

      // Ext1 unsubscribes (scope disposed)
      unsub1()
      v2.setValue(30)

      expect(ext1).not.toHaveBeenCalled()
      expect(ext2).toHaveBeenCalledOnce()
    })

    it('v1 chain-patch survival: removing v2 listener does not break v1 chain', () => {
      const { v1, v2, simulateV1Change } = createDualWidget('cfg', 7)
      const v1Handler = vi.fn()
      const v2Handler = vi.fn()

      const origCb = v1.callback
      v1.callback = function (val, a, n) {
        v1Handler(val)
        origCb?.call(this, val, a, n)
      }
      const unsub = v2.on('valueChange', v2Handler)

      unsub() // remove v2 listener only
      simulateV1Change(8)

      expect(v1Handler).toHaveBeenCalledWith(8) // v1 chain intact
      expect(v2Handler).not.toHaveBeenCalled()   // v2 removed
    })
  })
})
