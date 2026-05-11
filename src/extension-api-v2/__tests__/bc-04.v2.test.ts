// Category: BC.04 — Node interaction: pointer, selection, resize
// DB cross-ref: S2.N10, S2.N17, S2.N19
// blast_radius: 4.95 — compat-floor: blast_radius ≥ 2.0 — MUST pass before v2 ships
//
// API surface status (Phase A):
//   sizeChanged     — PRESENT  in NodeHandle (node.ts:501)
//   positionChanged — PRESENT  in NodeHandle (node.ts:490)
//   mouseDown       — NOT YET  (Phase B canvas event)
//   selected/deselected — NOT YET  (Phase B ECS event)
//
// Harness: inline MockNodeHandle — no ECS world needed for type-shape + event tests.

import { describe, expect, it, vi } from 'vitest'
import type { NodeSizeChangedEvent } from '@/extension-api/node'
import type { Unsubscribe } from '@/extension-api/events'

// ── Minimal mock ──────────────────────────────────────────────────────────────

interface SizeChangedEmitter {
  on(event: 'sizeChanged', handler: (e: NodeSizeChangedEvent) => void): Unsubscribe
  _emitSizeChanged(size: { width: number; height: number }): void
}

function createMockNode(): SizeChangedEmitter {
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

describe('BC.04 v2 contract — node interaction: pointer, selection, resize', () => {

  describe("on('sizeChanged') — resize feedback (S2.N19)", () => {
    it("fires with { size: { width, height } } when node dimensions change", () => {
      const node = createMockNode()
      const handler = vi.fn<[NodeSizeChangedEvent], void>()
      node.on('sizeChanged', handler)
      node._emitSizeChanged({ width: 300, height: 200 })
      expect(handler).toHaveBeenCalledOnce()
      expect(handler).toHaveBeenCalledWith({ size: { width: 300, height: 200 } })
    })

    it('fires again on subsequent resize; each call gets the latest size', () => {
      const node = createMockNode()
      const sizes: { width: number; height: number }[] = []
      node.on('sizeChanged', (e) => sizes.push(e.size))
      node._emitSizeChanged({ width: 100, height: 50 })
      node._emitSizeChanged({ width: 200, height: 80 })
      expect(sizes).toEqual([
        { width: 100, height: 50 },
        { width: 200, height: 80 }
      ])
    })

    it('unsubscribe stops future firings', () => {
      const node = createMockNode()
      const handler = vi.fn()
      const unsub = node.on('sizeChanged', handler)
      unsub()
      node._emitSizeChanged({ width: 300, height: 200 })
      expect(handler).not.toHaveBeenCalled()
    })

    it('multiple listeners all receive the event independently', () => {
      const node = createMockNode()
      const a = vi.fn(), b = vi.fn()
      node.on('sizeChanged', a)
      node.on('sizeChanged', b)
      node._emitSizeChanged({ width: 150, height: 120 })
      expect(a).toHaveBeenCalledOnce()
      expect(b).toHaveBeenCalledOnce()
    })

    it('unsubscribing one listener does not affect others', () => {
      const node = createMockNode()
      const a = vi.fn(), b = vi.fn()
      const unsubA = node.on('sizeChanged', a)
      node.on('sizeChanged', b)
      unsubA()
      node._emitSizeChanged({ width: 200, height: 100 })
      expect(a).not.toHaveBeenCalled()
      expect(b).toHaveBeenCalledOnce()
    })
  })

  describe("on('mouseDown') — pointer events (S2.N10) — Phase B", () => {
    it.todo(
      "[Phase B] handle.on('mouseDown', handler) fires when pointer-down occurs within node bounding box"
    )
    it.todo(
      "[Phase B] handler receives event with local x/y coordinates relative to node origin"
    )
    it.todo(
      "[Phase B] returning true stops LiteGraph default mouse handling"
    )
    it.todo(
      "[Phase B] listener is auto-removed when node is removed (no leak)"
    )
  })

  describe("on('selected') / on('deselected') — selection focus (S2.N17) — Phase B", () => {
    it.todo(
      "[Phase B] handle.on('selected', handler) fires when node enters selected state"
    )
    it.todo(
      "[Phase B] handle.on('deselected', handler) fires when node exits selected state"
    )
    it.todo(
      "[Phase B] selected/deselected do not fire for programmatic selection with { silent: true }"
    )
    it.todo(
      "[Phase B] isSelected() getter reflects current state at event fire time"
    )
  })
})
