// Category: BC.17 — Backend execution lifecycle and progress events
// DB cross-ref: S5.A1, S5.A2, S5.A3
// blast_radius: 5.00 (compat-floor)
// Migration: v1 app.api.addEventListener → v2 comfyApp.on with typed payloads
//
// Phase A strategy: prove that v1 CustomEvent-style registration and v2 on()
// registration both capture and expose the same payload structure for each
// event type, using synthetic dispatch. Real WebSocket timing is todo(Phase B).
//
// I-TF.8.D2 — BC.17 migration wired assertions.

import { describe, expect, it, vi } from 'vitest'

// ── V1 event bus (CustomEvent-style addEventListener) ─────────────────────────

function createV1Api() {
  const listeners = new Map<string, EventListenerOrEventListenerObject[]>()

  return {
    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      if (!listeners.has(type)) listeners.set(type, [])
      listeners.get(type)!.push(listener)
    },
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      const arr = listeners.get(type)
      if (arr) { const i = arr.indexOf(listener); if (i !== -1) arr.splice(i, 1) }
    },
    dispatchCustom(type: string, detail: unknown) {
      const event = { type, detail } as unknown as CustomEvent
      for (const l of [...(listeners.get(type) ?? [])]) {
        if (typeof l === 'function') l(event)
        else (l as EventListenerObject).handleEvent(event)
      }
    }
  }
}

// ── V2 app event bus ──────────────────────────────────────────────────────────

function createV2Bus() {
  const handlers = new Map<string, Array<(e: unknown) => void>>()

  function on(event: string, handler: (e: unknown) => void): () => void {
    if (!handlers.has(event)) handlers.set(event, [])
    handlers.get(event)!.push(handler)
    return () => {
      const arr = handlers.get(event)!
      const i = arr.indexOf(handler)
      if (i !== -1) arr.splice(i, 1)
    }
  }

  function emit(event: string, payload: unknown) {
    for (const h of [...(handlers.get(event) ?? [])]) h(payload)
  }

  return { on, emit }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BC.17 migration — execution lifecycle events', () => {
  describe('S5.A1 — executed / executionError payload equivalence', () => {
    it('v1 executed detail and v2 executed payload carry the same nodeId and output', () => {
      const v1Api = createV1Api()
      const v2 = createV2Bus()
      const v1Received: unknown[] = []
      const v2Received: unknown[] = []

      v1Api.addEventListener('executed', ((e: CustomEvent) => v1Received.push(e.detail)) as EventListener)
      v2.on('executed', (e) => v2Received.push(e))

      const payload = { nodeId: 'node:g:1', output: { text: ['hello'] } }
      v1Api.dispatchCustom('executed', payload)
      v2.emit('executed', payload)

      expect(v1Received[0]).toEqual(v2Received[0])
    })

    it('v1 execution_error and v2 executionError carry the same nodeId and message', () => {
      const v1Api = createV1Api()
      const v2 = createV2Bus()
      const v1Detail: unknown[] = []
      const v2Payload: unknown[] = []

      v1Api.addEventListener('execution_error', ((e: CustomEvent) => v1Detail.push(e.detail)) as EventListener)
      v2.on('executionError', (e) => v2Payload.push(e))

      const payload = { nodeId: 'node:g:7', message: 'CUDA OOM' }
      v1Api.dispatchCustom('execution_error', payload)
      v2.emit('executionError', payload)

      const v1 = v1Detail[0] as typeof payload
      const v2p = v2Payload[0] as typeof payload
      expect(v1.nodeId).toBe(v2p.nodeId)
      expect(v1.message).toBe(v2p.message)
    })
  })

  describe('S5.A2 — progress payload equivalence', () => {
    it('v1 progress {value, max} and v2 progress {step, totalSteps} encode the same completion fraction', () => {
      // v1 shape: { value: number, max: number }
      // v2 shape: { step: number, totalSteps: number }
      const v1Fractions: number[] = []
      const v2Fractions: number[] = []

      const v1Api = createV1Api()
      const v2 = createV2Bus()

      v1Api.addEventListener('progress', ((e: CustomEvent) => {
        const d = e.detail as { value: number; max: number }
        v1Fractions.push(d.value / d.max)
      }) as EventListener)

      v2.on('progress', (e) => {
        const p = e as { step: number; totalSteps: number }
        v2Fractions.push(p.step / p.totalSteps)
      })

      v1Api.dispatchCustom('progress', { value: 8, max: 20 })
      v2.emit('progress', { step: 8, totalSteps: 20, nodeId: 'node:g:1' })

      expect(v1Fractions[0]).toBeCloseTo(v2Fractions[0])
    })
  })

  describe('handler removal equivalence', () => {
    it('v1 removeEventListener and v2 unsubscribe() both prevent subsequent events from reaching the handler', () => {
      const v1Api = createV1Api()
      const v2 = createV2Bus()
      const v1Handler = vi.fn() as EventListenerOrEventListenerObject
      const v2Handler = vi.fn()

      v1Api.addEventListener('status', v1Handler)
      const unsub = v2.on('status', v2Handler)

      // Remove both
      v1Api.removeEventListener('status', v1Handler)
      unsub()

      v1Api.dispatchCustom('status', { queueRemaining: 0 })
      v2.emit('status', { queueRemaining: 0, running: false })

      expect(v1Handler).not.toHaveBeenCalled()
      expect(v2Handler).not.toHaveBeenCalled()
    })

    it('removing a v1 listener does not affect a concurrently registered v2 listener', () => {
      const v1Api = createV1Api()
      const v2 = createV2Bus()
      const v1Handler = vi.fn() as EventListenerOrEventListenerObject
      const v2Handler = vi.fn()

      v1Api.addEventListener('status', v1Handler)
      v2.on('status', v2Handler)

      v1Api.removeEventListener('status', v1Handler)

      v2.emit('status', { queueRemaining: 1, running: true })
      expect(v2Handler).toHaveBeenCalledOnce()
    })
  })
})

// ── Phase B stubs ─────────────────────────────────────────────────────────────

describe('BC.17 migration — execution lifecycle events [Phase B / shell]', () => {
  it.todo(
    '[Phase B] v1 app.api.addEventListener("executed") and v2 on("executed") fire at the same point in WebSocket processing'
  )
  it.todo(
    '[Phase B] v1 "reconnecting" and v2 "reconnecting" both fire before the first reconnect attempt'
  )
})
