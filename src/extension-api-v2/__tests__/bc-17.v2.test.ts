// Category: BC.17 — Backend execution lifecycle and progress events
// DB cross-ref: S5.A1, S5.A2, S5.A3
// Exemplar: https://github.com/AIGODLIKE/AIGODLIKE-ComfyUI-Studio/blob/main/loader/components/public/iconRenderer.js#L39
// blast_radius: 5.00 (compat-floor)
// compat-floor: blast_radius ≥ 2.0
// v2 replacement: comfyApp.on('executed', fn), comfyApp.on('progress', fn) — typed event payloads
//
// Phase A strategy: prove the registration contract (on() returns Unsubscribe,
// handlers fire when emitted, multiple handlers are independent) using a
// synthetic typed app-level event bus. Real WebSocket delivery is todo(Phase B).
//
// I-TF.8.D2 — BC.17 v2 wired assertions.

import { describe, expect, it, vi } from 'vitest'
import type { Unsubscribe } from '@/extension-api/events'

// ── Typed payload shapes (mirrors what the real shell will emit) ──────────────

interface ExecutedPayload { nodeId: string; output: Record<string, unknown> }
interface ExecutionErrorPayload { nodeId: string; message: string }
interface ExecutionStartPayload { promptId: string }
interface ProgressPayload { step: number; totalSteps: number; nodeId: string }
interface StatusPayload { queueRemaining: number; running: boolean }
interface ReconnectingPayload { attempt: number }

type AppEventMap = {
  executed: ExecutedPayload
  executionError: ExecutionErrorPayload
  executionStart: ExecutionStartPayload
  progress: ProgressPayload
  status: StatusPayload
  reconnecting: ReconnectingPayload
}

// ── Minimal typed app event bus ───────────────────────────────────────────────

function createAppEventBus() {
  const handlers = new Map<string, Array<(e: unknown) => void>>()

  function on<K extends keyof AppEventMap>(event: K, handler: (e: AppEventMap[K]) => void): Unsubscribe {
    if (!handlers.has(event)) handlers.set(event, [])
    const arr = handlers.get(event)!
    arr.push(handler as (e: unknown) => void)
    return () => {
      const i = arr.indexOf(handler as (e: unknown) => void)
      if (i !== -1) arr.splice(i, 1)
    }
  }

  function emit<K extends keyof AppEventMap>(event: K, payload: AppEventMap[K]) {
    for (const h of [...(handlers.get(event) ?? [])]) h(payload)
  }

  function handlerCount(event: string) { return handlers.get(event)?.length ?? 0 }

  return { on, emit, handlerCount }
}

// ── Wired assertions ──────────────────────────────────────────────────────────

describe('BC.17 v2 contract — comfyApp event subscriptions', () => {
  describe('S5.A1 — execution lifecycle events', () => {
    it('on("executed", fn) returns an Unsubscribe function', () => {
      const bus = createAppEventBus()
      const unsub = bus.on('executed', () => {})
      expect(typeof unsub).toBe('function')
    })

    it('on("executed") handler fires with typed { nodeId, output } payload', () => {
      const bus = createAppEventBus()
      let received: ExecutedPayload | undefined
      bus.on('executed', (e) => { received = e })
      bus.emit('executed', { nodeId: 'node:g:42', output: { text: ['hi'] } })
      expect(received).toBeDefined()
      expect(received!.nodeId).toBe('node:g:42')
      expect(received!.output.text).toEqual(['hi'])
    })

    it('on("executionError") handler fires with typed { nodeId, message } payload', () => {
      const bus = createAppEventBus()
      let received: ExecutionErrorPayload | undefined
      bus.on('executionError', (e) => { received = e })
      bus.emit('executionError', { nodeId: 'node:g:7', message: 'CUDA OOM' })
      expect(received!.nodeId).toBe('node:g:7')
      expect(received!.message).toBe('CUDA OOM')
    })

    it('on("executionStart") handler fires with typed { promptId } payload', () => {
      const bus = createAppEventBus()
      let received: ExecutionStartPayload | undefined
      bus.on('executionStart', (e) => { received = e })
      bus.emit('executionStart', { promptId: 'abc-123' })
      expect(received!.promptId).toBe('abc-123')
    })
  })

  describe('S5.A2 — progress events', () => {
    it('on("progress") handler fires with typed { step, totalSteps, nodeId } payload', () => {
      const bus = createAppEventBus()
      let received: ProgressPayload | undefined
      bus.on('progress', (e) => { received = e })
      bus.emit('progress', { step: 5, totalSteps: 20, nodeId: 'node:g:1' })
      expect(received!.step).toBe(5)
      expect(received!.totalSteps).toBe(20)
      expect(received!.nodeId).toBe('node:g:1')
    })

    it('progress percentage (step / totalSteps) encodes the same fraction as v1 (value / max)', () => {
      const bus = createAppEventBus()
      const fractions: number[] = []
      bus.on('progress', (e) => fractions.push(e.step / e.totalSteps))
      bus.emit('progress', { step: 10, totalSteps: 20, nodeId: 'node:g:1' })
      bus.emit('progress', { step: 20, totalSteps: 20, nodeId: 'node:g:1' })
      expect(fractions[0]).toBeCloseTo(0.5)
      expect(fractions[1]).toBeCloseTo(1.0)
    })
  })

  describe('S5.A3 — status and connectivity events', () => {
    it('on("status") handler fires with typed { queueRemaining, running } payload', () => {
      const bus = createAppEventBus()
      let received: StatusPayload | undefined
      bus.on('status', (e) => { received = e })
      bus.emit('status', { queueRemaining: 3, running: true })
      expect(received!.queueRemaining).toBe(3)
      expect(received!.running).toBe(true)
    })

    it('on("reconnecting") handler fires with typed { attempt } payload', () => {
      const bus = createAppEventBus()
      let received: ReconnectingPayload | undefined
      bus.on('reconnecting', (e) => { received = e })
      bus.emit('reconnecting', { attempt: 1 })
      expect(received!.attempt).toBe(1)
    })

    it('Unsubscribe returned by on() removes the handler', () => {
      const bus = createAppEventBus()
      const handler = vi.fn()
      const unsub = bus.on('status', handler)
      bus.emit('status', { queueRemaining: 0, running: false })
      expect(handler).toHaveBeenCalledOnce()
      unsub()
      bus.emit('status', { queueRemaining: 0, running: false })
      expect(handler).toHaveBeenCalledOnce() // no new call
    })

    it('unsubscribing one handler does not affect other subscribers on the same event', () => {
      const bus = createAppEventBus()
      const handlerA = vi.fn()
      const handlerB = vi.fn()
      const unsubA = bus.on('status', handlerA)
      bus.on('status', handlerB)
      unsubA()
      bus.emit('status', { queueRemaining: 1, running: true })
      expect(handlerA).not.toHaveBeenCalled()
      expect(handlerB).toHaveBeenCalledOnce()
    })

    it('calling Unsubscribe twice does not throw', () => {
      const bus = createAppEventBus()
      const unsub = bus.on('reconnecting', vi.fn())
      expect(() => { unsub(); unsub() }).not.toThrow()
    })
  })

  describe('cross-event independence', () => {
    it('"executed" handler does not fire when "progress" is emitted', () => {
      const bus = createAppEventBus()
      const executedHandler = vi.fn()
      bus.on('executed', executedHandler)
      bus.emit('progress', { step: 1, totalSteps: 10, nodeId: 'node:g:1' })
      expect(executedHandler).not.toHaveBeenCalled()
    })
  })
})

// ── Phase B stubs ─────────────────────────────────────────────────────────────

describe('BC.17 v2 contract — comfyApp events [Phase B / shell]', () => {
  it.todo(
    '[Phase B] on("executed") fires when the real WebSocket "executed" message arrives'
  )
  it.todo(
    '[Phase B] on("progress") fires on each step tick from the real backend'
  )
  it.todo(
    '[Phase B] on("status") fires when queue depth or running state changes via WebSocket'
  )
  it.todo(
    '[Phase B] on("reconnecting") fires before the first reconnect attempt after connection loss'
  )
})
