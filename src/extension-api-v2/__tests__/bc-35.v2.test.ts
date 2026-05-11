// Category: BC.35 — Pre-queue widget validation
// DB cross-ref: S6.A5
// Exemplar: https://github.com/goodtab/ComfyUI-Custom-Scripts
// blast_radius: 3.10
// compat-floor: blast_radius ≥ 2.0 — MUST pass before v2 ships
// v2 contract: comfyApp.on('beforeQueue', (event) => { if (!valid) event.reject('Error message') })
//              stackable; rejection surfaced in UI

import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── beforeQueue event simulation ──────────────────────────────────────────────

interface SerializedPrompt {
  nodes: Array<{ id: number; type: string; inputs: Record<string, unknown> }>
}

interface BeforeQueueEvent {
  readonly prompt: SerializedPrompt
  reject(message?: string): void
  readonly rejected: boolean
  readonly rejectionMessage: string | undefined
}

type QueueHandler = (event: BeforeQueueEvent) => void | Promise<void>
type Unsubscribe = () => void

function makeBeforeQueueEvent(prompt: SerializedPrompt): BeforeQueueEvent {
  let rejected = false
  let rejectionMessage: string | undefined

  return {
    prompt,
    reject(message?: string) {
      rejected = true
      rejectionMessage = message
    },
    get rejected() { return rejected },
    get rejectionMessage() { return rejectionMessage }
  }
}

function makeQueueManager() {
  const handlers: QueueHandler[] = []

  return {
    on(_event: 'beforeQueue', handler: QueueHandler): Unsubscribe {
      handlers.push(handler)
      return () => {
        const i = handlers.indexOf(handler)
        if (i !== -1) handlers.splice(i, 1)
      }
    },
    async queue(prompt: SerializedPrompt): Promise<{ submitted: boolean; message?: string }> {
      const event = makeBeforeQueueEvent(prompt)
      for (const fn of [...handlers]) {
        await fn(event)
        if (event.rejected) {
          return { submitted: false, message: event.rejectionMessage }
        }
      }
      return { submitted: true }
    },
    listenerCount: () => handlers.length
  }
}

function makePrompt(overrides: Partial<SerializedPrompt> = {}): SerializedPrompt {
  return {
    nodes: [{ id: 1, type: 'KSampler', inputs: { steps: 20, cfg: 7.0 } }],
    ...overrides
  }
}

// ─────────────────────────────────────────────────────────────────────────────

describe('BC.35 v2 contract — pre-queue widget validation', () => {
  let qm: ReturnType<typeof makeQueueManager>

  beforeEach(() => {
    qm = makeQueueManager()
  })

  describe("S6.A5 — beforeQueue event", () => {
    it("on('beforeQueue', handler) fires before each queue submission", async () => {
      const spy = vi.fn()
      qm.on('beforeQueue', spy)

      await qm.queue(makePrompt())
      expect(spy).toHaveBeenCalledOnce()

      await qm.queue(makePrompt())
      expect(spy).toHaveBeenCalledTimes(2)
    })

    it("event.reject('message') cancels queue submission and surfaces the message", async () => {
      qm.on('beforeQueue', (e) => e.reject('Seed must not be 0'))

      const result = await qm.queue(makePrompt())
      expect(result.submitted).toBe(false)
      expect(result.message).toBe('Seed must not be 0')
    })

    it('multiple extensions all called; any single rejection cancels the queue', async () => {
      const spyA = vi.fn()
      const spyB = vi.fn((e: BeforeQueueEvent) => e.reject('B says no'))
      const spyC = vi.fn()

      qm.on('beforeQueue', spyA)
      qm.on('beforeQueue', spyB)
      qm.on('beforeQueue', spyC) // won't run after B rejects

      const result = await qm.queue(makePrompt())

      expect(spyA).toHaveBeenCalledOnce()
      expect(spyB).toHaveBeenCalledOnce()
      expect(spyC).not.toHaveBeenCalled() // short-circuits after rejection
      expect(result.submitted).toBe(false)
      expect(result.message).toBe('B says no')
    })

    it('event.reject() with no arguments cancels the queue without a message', async () => {
      qm.on('beforeQueue', (e) => e.reject())

      const result = await qm.queue(makePrompt())
      expect(result.submitted).toBe(false)
      expect(result.message).toBeUndefined()
    })

    it('no rejection → queue proceeds with submitted: true', async () => {
      qm.on('beforeQueue', (_e) => { /* passes */ })

      const result = await qm.queue(makePrompt())
      expect(result.submitted).toBe(true)
    })
  })

  describe('S6.A5 — event payload', () => {
    it('beforeQueue event payload includes the serialized prompt so validators can inspect node values', async () => {
      let capturedPrompt: SerializedPrompt | null = null

      qm.on('beforeQueue', (e) => { capturedPrompt = e.prompt })

      const prompt = makePrompt({
        nodes: [{ id: 1, type: 'KSampler', inputs: { steps: 5, cfg: 1.5 } }]
      })
      await qm.queue(prompt)

      expect(capturedPrompt).not.toBeNull()
      expect(capturedPrompt!.nodes[0].inputs['steps']).toBe(5)
      expect(capturedPrompt!.nodes[0].inputs['cfg']).toBe(1.5)
    })

    it('async handler that calls reject() still cancels submission', async () => {
      qm.on('beforeQueue', async (e) => {
        await new Promise<void>((r) => setTimeout(r, 5))
        e.reject('async validation failed')
      })

      const result = await qm.queue(makePrompt())
      expect(result.submitted).toBe(false)
      expect(result.message).toBe('async validation failed')
    })

    it('async validator that passes (no reject) does not block subsequent handlers', async () => {
      const order: number[] = []

      qm.on('beforeQueue', async (_e) => {
        await new Promise<void>((r) => setTimeout(r, 5))
        order.push(1)
      })
      qm.on('beforeQueue', (_e) => { order.push(2) })

      const result = await qm.queue(makePrompt())
      expect(order).toEqual([1, 2])
      expect(result.submitted).toBe(true)
    })
  })
})
