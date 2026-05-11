// Category: BC.16 — Execution output consumption (per-node)
// DB cross-ref: S2.N2
// Exemplar: https://github.com/andreszs/ComfyUI-Ultralytics-Studio/blob/main/js/show_string.js#L9
// blast_radius: 4.67 (compat-floor)
// compat-floor: blast_radius ≥ 2.0
// v2 replacement: NodeHandle.on('executed', handler)
//
// Phase A strategy: prove the on('executed') registration contract and
// NodeExecutedEvent payload shape using a minimal typed event bus.
// Real WebSocket delivery needs Phase B shell integration.
//
// I-TF.8.D2 — BC.16 v2 wired assertions.

import { describe, expect, it, vi } from 'vitest'
import type { NodeExecutedEvent } from '@/extension-api/node'
import type { Unsubscribe } from '@/extension-api/events'

// ── Minimal executed event bus ────────────────────────────────────────────────

function createExecutedBus() {
  const handlers: Array<(e: NodeExecutedEvent) => void> = []

  function on(_event: 'executed', handler: (e: NodeExecutedEvent) => void): Unsubscribe {
    handlers.push(handler)
    return () => {
      const i = handlers.indexOf(handler)
      if (i !== -1) handlers.splice(i, 1)
    }
  }

  function emit(event: NodeExecutedEvent) {
    for (const h of [...handlers]) h(event)
  }

  return { on, emit, handlerCount: () => handlers.length }
}

// ── Fixture ───────────────────────────────────────────────────────────────────

function makeExecutedEvent(overrides: Partial<NodeExecutedEvent> = {}): NodeExecutedEvent {
  return {
    output: { text: ['hello world'], images: [] },
    ...overrides
  }
}

// ── Wired assertions ──────────────────────────────────────────────────────────

describe('BC.16 v2 contract — NodeHandle executed event', () => {
  describe('event subscription shape', () => {
    it('on("executed", fn) returns an Unsubscribe function', () => {
      const bus = createExecutedBus()
      const unsub = bus.on('executed', () => {})
      expect(typeof unsub).toBe('function')
    })

    it('registered handler is called when an executed event fires', () => {
      const bus = createExecutedBus()
      const handler = vi.fn()
      bus.on('executed', handler)
      bus.emit(makeExecutedEvent())
      expect(handler).toHaveBeenCalledOnce()
    })

    it('handler receives a NodeExecutedEvent with an output field', () => {
      const bus = createExecutedBus()
      let received: NodeExecutedEvent | undefined
      bus.on('executed', (e) => { received = e })
      bus.emit(makeExecutedEvent({ output: { text: ['result'], images: [] } }))
      expect(received).toBeDefined()
      expect(received!.output).toBeDefined()
    })

    it('calling Unsubscribe stops future executed events from reaching the handler', () => {
      const bus = createExecutedBus()
      const handler = vi.fn()
      const unsub = bus.on('executed', handler)
      bus.emit(makeExecutedEvent())
      expect(handler).toHaveBeenCalledOnce()
      unsub()
      bus.emit(makeExecutedEvent())
      expect(handler).toHaveBeenCalledOnce() // no additional call
    })

    it('calling Unsubscribe twice is safe', () => {
      const bus = createExecutedBus()
      const unsub = bus.on('executed', vi.fn())
      expect(() => { unsub(); unsub() }).not.toThrow()
    })
  })

  describe('NodeExecutedEvent payload shape', () => {
    it('event.output.text is an array (string[] for text-output nodes)', () => {
      const bus = createExecutedBus()
      let output: NodeExecutedEvent['output'] | undefined
      bus.on('executed', (e) => { output = e.output })
      bus.emit(makeExecutedEvent({ output: { text: ['line1', 'line2'], images: [] } }))
      expect(Array.isArray(output!.text)).toBe(true)
      expect(output!.text).toEqual(['line1', 'line2'])
    })

    it('event.output.images is an array', () => {
      const bus = createExecutedBus()
      let output: NodeExecutedEvent['output'] | undefined
      bus.on('executed', (e) => { output = e.output })
      bus.emit(makeExecutedEvent({ output: { text: [], images: [] } }))
      expect(Array.isArray(output!.images)).toBe(true)
    })

    it('output fields are accessible without a cast from within the handler', () => {
      // Type-level: NodeExecutedEvent.output.text should be string[] — compile-time.
      // Runtime: values are accessible as typed properties.
      const bus = createExecutedBus()
      const texts: string[] = []
      bus.on('executed', (e) => {
        for (const t of e.output.text ?? []) texts.push(t)
      })
      bus.emit(makeExecutedEvent({ output: { text: ['alpha', 'beta'], images: [] } }))
      expect(texts).toEqual(['alpha', 'beta'])
    })
  })

  describe('multiple handlers', () => {
    it('multiple on("executed") handlers all fire independently', () => {
      const bus = createExecutedBus()
      const handlerA = vi.fn()
      const handlerB = vi.fn()
      bus.on('executed', handlerA)
      bus.on('executed', handlerB)
      bus.emit(makeExecutedEvent())
      expect(handlerA).toHaveBeenCalledOnce()
      expect(handlerB).toHaveBeenCalledOnce()
    })

    it('unsubscribing one handler does not affect the others', () => {
      const bus = createExecutedBus()
      const handlerA = vi.fn()
      const handlerB = vi.fn()
      const unsubA = bus.on('executed', handlerA)
      bus.on('executed', handlerB)
      unsubA()
      bus.emit(makeExecutedEvent())
      expect(handlerA).not.toHaveBeenCalled()
      expect(handlerB).toHaveBeenCalledOnce()
    })
  })

  describe('handler lifecycle with scope', () => {
    it('after all handlers are unsubscribed, the bus has zero active handlers', () => {
      const bus = createExecutedBus()
      const unsubA = bus.on('executed', vi.fn())
      const unsubB = bus.on('executed', vi.fn())
      expect(bus.handlerCount()).toBe(2)
      unsubA()
      unsubB()
      expect(bus.handlerCount()).toBe(0)
    })
  })
})

// ── Phase B stubs ─────────────────────────────────────────────────────────────

describe('BC.16 v2 contract — NodeHandle executed event [Phase B / shell]', () => {
  it.todo(
    '[Phase B] NodeHandle.on("executed") fires when the real WebSocket executed message arrives for this node'
  )
  it.todo(
    '[Phase B] handlers registered via on("executed") are automatically removed when the node is removed from the World'
  )
  it.todo(
    '[Phase B] output.images includes filename, subfolder, and type fields matching the backend response schema'
  )
})
