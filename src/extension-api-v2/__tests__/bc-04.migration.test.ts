// Category: BC.04 — Node interaction: pointer, selection, resize
// DB cross-ref: S2.N10, S2.N17, S2.N19
// blast_radius: 4.95 — compat-floor ≥ 2.0
// Migration: v1 prototype assignments → v2 handle.on() subscriptions
//
// v1 pattern (S2.N19):
//   nodeType.prototype.onResize = function([w, h]) { relayout(w, h) }
// v2 pattern:
//   node.on('sizeChanged', (e) => relayout(e.size.width, e.size.height))
//
// sizeChanged is the only BC.04 event testable in Phase A.
// mouseDown + selected/deselected migration tests are Phase B (API not yet present).

import { describe, expect, it, vi } from 'vitest'
import type { NodeSizeChangedEvent } from '@/extension-api/node'
import type { Unsubscribe } from '@/extension-api/events'

// ── Shared mock ───────────────────────────────────────────────────────────────

interface MockNode {
  on(event: 'sizeChanged', handler: (e: NodeSizeChangedEvent) => void): Unsubscribe
  _emitSizeChanged(size: { width: number; height: number }): void
}

function createMockNode(): MockNode {
  const listeners: Array<(e: NodeSizeChangedEvent) => void> = []
  return {
    on(_event: 'sizeChanged', handler: (e: NodeSizeChangedEvent) => void): Unsubscribe {
      listeners.push(handler)
      return () => {
        const idx = listeners.indexOf(handler)
        if (idx !== -1) listeners.splice(idx, 1)
      }
    },
    _emitSizeChanged(size) {
      const event: NodeSizeChangedEvent = { size }
      for (const fn of [...listeners]) fn(event)
    }
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BC.04 migration — node interaction: pointer, selection, resize', () => {

  describe('resize parity: v1 onResize([w,h]) ↔ v2 on("sizeChanged", { size }) (S2.N19)', () => {
    it('v2 sizeChanged handler receives same dimensions that v1 onResize received', () => {
      const node = createMockNode()
      const v2Sizes: { width: number; height: number }[] = []
      node.on('sizeChanged', (e) => v2Sizes.push(e.size))

      // Simulate the same resize LiteGraph called node.onResize([300, 200]) for
      node._emitSizeChanged({ width: 300, height: 200 })

      expect(v2Sizes).toEqual([{ width: 300, height: 200 }])
    })

    it('multiple resize events all reach the v2 handler (parity with repeated v1 onResize calls)', () => {
      const node = createMockNode()
      const widths: number[] = []
      node.on('sizeChanged', (e) => widths.push(e.size.width))
      node._emitSizeChanged({ width: 100, height: 50 })
      node._emitSizeChanged({ width: 200, height: 80 })
      node._emitSizeChanged({ width: 300, height: 120 })
      expect(widths).toEqual([100, 200, 300])
    })

    it.todo(
      '[Phase B] computeSize overrides that triggered v1 onResize still trigger v2 sizeChanged'
    )
  })

  describe('mousedown parity (S2.N10) — Phase B', () => {
    it.todo(
      '[Phase B] v1 node.onMouseDown and v2 handle.on("mouseDown") both fire for the same pointer-down event'
    )
    it.todo(
      '[Phase B] local coordinates in v1 onMouseDown(event, [x,y]) match v2 event.x / event.y'
    )
    it.todo(
      '[Phase B] propagation-stop: v1 return true ≡ v2 event.stopPropagation()'
    )
  })

  describe('selection parity (S2.N17) — Phase B', () => {
    it.todo(
      '[Phase B] v1 node.onSelected and v2 handle.on("selected") both fire when node is selected'
    )
    it.todo(
      '[Phase B] v2 introduces explicit deselected event; migration must add deselected handler for cleanup that relied on onSelected re-fire in v1'
    )
  })

  describe('listener lifetime parity', () => {
    it('v2 unsub() gives explicit cleanup control (v1 prototype assignments had no built-in cleanup)', () => {
      const node = createMockNode()
      const handler = vi.fn()
      const unsub = node.on('sizeChanged', handler)
      unsub()
      node._emitSizeChanged({ width: 100, height: 50 })
      expect(handler).not.toHaveBeenCalled()
    })
  })
})
