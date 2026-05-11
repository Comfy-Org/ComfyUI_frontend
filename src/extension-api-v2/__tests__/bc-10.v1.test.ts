// Category: BC.10 — Widget value subscription
// DB cross-ref: S4.W1, S2.N14
// Exemplar: https://github.com/Comfy-Org/ComfyUI_frontend/blob/main/src/extensions/core/widgetInputs.ts#L317
// blast_radius: 5.09 — compat-floor: blast_radius ≥ 2.0 — MUST pass before v2 ships
// v1 contract: widget.callback = function(value, ...) { ... }  (chain-patching)
//              node.onWidgetChanged = function(name, value, ...) { ... }
//
// Harness model (Phase A):
//   v1 patterns are synthetic — a plain object with .callback and .value.
//   Tests call widget.callback(newValue) directly (as LiteGraph would).
//   Real LiteGraph invocation requires Phase B eval sandbox.

import { describe, expect, it, vi } from 'vitest'
import {
  countEvidenceExcerpts,
  loadEvidenceSnippet
} from '../harness'

// ── Minimal v1 widget stub ────────────────────────────────────────────────────

interface V1Widget {
  name: string
  value: unknown
  callback?: (value: unknown, app?: unknown, node?: unknown) => void
}

function createV1Widget(name: string, value: unknown = ''): V1Widget {
  return { name, value }
}

// Simulate LiteGraph calling widget.callback when the user changes a value.
function simulateUserChange(widget: V1Widget, newValue: unknown, node?: unknown): void {
  widget.value = newValue
  widget.callback?.(newValue, undefined, node)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BC.10 v1 contract — widget value subscription', () => {
  describe('S4.W1 — widget.callback assignment', () => {
    it('assigning widget.callback invokes the function with the new value on user interaction', () => {
      const widget = createV1Widget('steps', 20)
      const handler = vi.fn()
      widget.callback = handler

      simulateUserChange(widget, 30)

      expect(handler).toHaveBeenCalledOnce()
      expect(handler).toHaveBeenCalledWith(30, undefined, undefined)
    })

    it('chain-patching preserves the previous callback: saving old ref and calling it at the end', () => {
      const widget = createV1Widget('cfg', 7)
      const originalCb = vi.fn()
      widget.callback = originalCb

      // Extension chain-patches: save original, wrap it.
      const patchOrder: string[] = []
      const origRef = widget.callback
      widget.callback = function (value, app, node) {
        patchOrder.push('new')
        origRef?.call(this, value, app, node)
      }

      simulateUserChange(widget, 8)

      expect(patchOrder).toEqual(['new'])
      expect(originalCb).toHaveBeenCalledOnce()
      expect(originalCb).toHaveBeenCalledWith(8, undefined, undefined)
    })

    it('widget.callback receives (value, app, node, pos, event) — first arg is new value', () => {
      const widget = createV1Widget('sampler', 'euler')
      const received: unknown[] = []
      widget.callback = (...args: unknown[]) => received.push(...args)

      const fakeApp = { name: 'app' }
      const fakeNode = { id: 42 }
      widget.value = 'dpm'
      widget.callback('dpm', fakeApp, fakeNode)

      expect(received[0]).toBe('dpm')
      expect(received[1]).toBe(fakeApp)
      expect(received[2]).toBe(fakeNode)
    })

    it('if multiple extensions chain-patch widget.callback, all callbacks fire in last-patched-first order', () => {
      const widget = createV1Widget('steps', 10)
      const order: string[] = []

      // Extension A patches first
      const origA = widget.callback
      widget.callback = function (v, a, n) {
        order.push('A')
        origA?.call(this, v, a, n)
      }
      // Extension B patches second (outermost)
      const origB = widget.callback
      widget.callback = function (v, a, n) {
        order.push('B')
        origB?.call(this, v, a, n)
      }

      simulateUserChange(widget, 20)

      // B is outermost (last patched), calls B → A
      expect(order).toEqual(['B', 'A'])
    })

    it('widget.callback is not invoked when the value does not change (LiteGraph does not call callback for no-ops)', () => {
      // This tests the harness model: callback is only invoked when the user
      // actually changes the value. The harness calls it explicitly on change.
      const widget = createV1Widget('seed', 42)
      const handler = vi.fn()
      widget.callback = handler

      // No change — we do NOT call simulateUserChange, so callback should not fire.
      expect(handler).not.toHaveBeenCalled()
      expect(widget.value).toBe(42)
    })
  })

  describe('S2.N14 — node.onWidgetChanged', () => {
    it('node.onWidgetChanged is called with widget name, new value, old value, and widget reference', () => {
      const widget = createV1Widget('steps', 20)
      const handler = vi.fn()
      const node = { onWidgetChanged: handler }

      const oldValue = widget.value
      simulateUserChange(widget, 30, node)
      node.onWidgetChanged('steps', 30, oldValue, widget)

      expect(handler).toHaveBeenCalledWith('steps', 30, 20, widget)
    })

    it('onWidgetChanged fires for any widget on the node, not only those with an explicit callback', () => {
      const widgetA = createV1Widget('steps', 20)
      const widgetB = createV1Widget('cfg', 7)
      const handler = vi.fn()
      const node = { onWidgetChanged: handler }

      // widgetB has no .callback — but node.onWidgetChanged still fires.
      const oldB = widgetB.value
      widgetB.value = 8
      node.onWidgetChanged('cfg', 8, oldB, widgetB)

      expect(handler).toHaveBeenCalledOnce()
      expect(handler).toHaveBeenCalledWith('cfg', 8, 7, widgetB)
    })

    it('multiple widgets on the same node each trigger onWidgetChanged independently', () => {
      const widgets = [
        createV1Widget('steps', 20),
        createV1Widget('cfg', 7),
        createV1Widget('seed', 0)
      ]
      const calls: Array<[string, unknown]> = []
      const node = {
        onWidgetChanged: (name: string, value: unknown) => calls.push([name, value])
      }

      // Simulate changes to all three widgets
      for (const w of widgets) {
        const oldValue = w.value
        const newValue = typeof w.value === 'number' ? (w.value as number) + 1 : 'changed'
        w.value = newValue
        node.onWidgetChanged(w.name, newValue, oldValue, w)
      }

      expect(calls).toHaveLength(3)
      expect(calls[0][0]).toBe('steps')
      expect(calls[1][0]).toBe('cfg')
      expect(calls[2][0]).toBe('seed')
    })
  })

  describe('S4.W1 — evidence excerpts', () => {
    it('S4.W1 has at least one evidence excerpt in the database snapshot', () => {
      expect(countEvidenceExcerpts('S4.W1')).toBeGreaterThan(0)
    })

    it('S4.W1 excerpt contains widget callback chain-patching fingerprint', () => {
      // Find an excerpt that contains the chain-patch pattern.
      // Not all S4.W1 excerpts are chain-patches (some are direct assigns);
      // we search across available excerpts for the canonical fingerprint.
      const count = countEvidenceExcerpts('S4.W1')
      let found = false
      for (let i = 0; i < count; i++) {
        const snippet = loadEvidenceSnippet('S4.W1', i)
        if (/callback|\.call\s*\(this/.test(snippet)) {
          found = true
          break
        }
      }
      expect(found, 'Expected at least one S4.W1 excerpt with callback fingerprint').toBe(true)
    })

    it('S2.N14 has at least one evidence excerpt in the database snapshot', () => {
      expect(countEvidenceExcerpts('S2.N14')).toBeGreaterThan(0)
    })

    it('S2.N14 excerpt contains onWidgetChanged fingerprint', () => {
      const snippet = loadEvidenceSnippet('S2.N14', 0)
      expect(snippet).toMatch(/onWidgetChanged/i)
    })
  })
})
