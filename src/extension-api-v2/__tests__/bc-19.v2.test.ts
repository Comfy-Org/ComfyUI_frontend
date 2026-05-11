// Category: BC.19 — Workflow execution trigger
// DB cross-ref: S6.A4
// Exemplar: https://github.com/MajoorWaldi/ComfyUI-Majoor-AssetsManager/blob/main/js/features/viewer/workflowSidebar/sidebarRunButton.js#L317
// blast_radius: 6.09 (compat-floor)
// compat-floor: blast_radius ≥ 2.0
// v2 replacement: comfyApp.on('beforeQueuePrompt') with event.payload mutation + event.cancel()
//
// Phase A strategy: prove the beforeQueuePrompt registration contract and
// event object shape (payload mutation, cancel(), multiple handlers) using
// a synthetic queue trigger. Real HTTP submission to /prompt is todo(Phase B).
//
// I-TF.8.D2 — BC.19 v2 wired assertions.

import { describe, expect, it, vi } from 'vitest'
import type { Unsubscribe } from '@/extension-api/events'

// ── Synthetic queue trigger ───────────────────────────────────────────────────

interface QueuePayload {
  prompt: Record<string, unknown>
  extra_data: Record<string, unknown>
  client_id?: string
}

interface BeforeQueuePromptEvent {
  payload: QueuePayload
  cancel(): void
}

function createQueueTrigger() {
  const handlers: Array<(e: BeforeQueuePromptEvent) => void> = []
  const submitLog: QueuePayload[] = []

  function on(_event: 'beforeQueuePrompt', handler: (e: BeforeQueuePromptEvent) => void): Unsubscribe {
    handlers.push(handler)
    return () => {
      const i = handlers.indexOf(handler)
      if (i !== -1) handlers.splice(i, 1)
    }
  }

  async function queuePrompt(opts: { batchCount?: number } = {}): Promise<{ submitted: boolean; batchCount: number }> {
    const batchCount = opts.batchCount ?? 1
    let cancelled = false
    const payload: QueuePayload = {
      prompt: {},
      extra_data: { extra_pnginfo: {} }
    }
    const event: BeforeQueuePromptEvent = {
      payload,
      cancel() { cancelled = true }
    }
    for (const h of [...handlers]) {
      h(event)
      if (cancelled) break
    }
    if (cancelled) return { submitted: false, batchCount: 0 }
    submitLog.push({ ...event.payload })
    return { submitted: true, batchCount }
  }

  return { on, queuePrompt, submitLog, handlerCount: () => handlers.length }
}

// ── Wired assertions ──────────────────────────────────────────────────────────

describe('BC.19 v2 contract — beforeQueuePrompt event and comfyApp.queuePrompt', () => {
  describe('beforeQueuePrompt registration', () => {
    it('on("beforeQueuePrompt", fn) returns an Unsubscribe function', () => {
      const q = createQueueTrigger()
      const unsub = q.on('beforeQueuePrompt', () => {})
      expect(typeof unsub).toBe('function')
    })

    it('handler fires before the prompt is submitted', async () => {
      const q = createQueueTrigger()
      const order: string[] = []
      q.on('beforeQueuePrompt', () => order.push('handler'))
      const { submitted } = await q.queuePrompt()
      order.push('after')
      expect(order[0]).toBe('handler')
      expect(submitted).toBe(true)
    })

    it('handler receives a BeforeQueuePromptEvent with a mutable payload', async () => {
      const q = createQueueTrigger()
      let receivedPayload: QueuePayload | undefined
      q.on('beforeQueuePrompt', (e) => { receivedPayload = e.payload })
      await q.queuePrompt()
      expect(receivedPayload).toBeDefined()
      expect(receivedPayload).toHaveProperty('prompt')
      expect(receivedPayload).toHaveProperty('extra_data')
    })
  })

  describe('payload mutation', () => {
    it('mutating event.payload.extra_data.extra_pnginfo in the handler persists into the submitted payload', async () => {
      const q = createQueueTrigger()
      q.on('beforeQueuePrompt', (e) => {
        e.payload.extra_data.extra_pnginfo = { workflow: 'injected' }
      })
      await q.queuePrompt()
      expect(q.submitLog[0].extra_data.extra_pnginfo).toEqual({ workflow: 'injected' })
    })

    it('multiple handlers see each other\'s mutations in order', async () => {
      const q = createQueueTrigger()
      q.on('beforeQueuePrompt', (e) => { (e.payload.extra_data as Record<string, unknown>).step1 = true })
      q.on('beforeQueuePrompt', (e) => {
        expect((e.payload.extra_data as Record<string, unknown>).step1).toBe(true)
        ;(e.payload.extra_data as Record<string, unknown>).step2 = true
      })
      await q.queuePrompt()
      expect(q.submitLog[0].extra_data.step1).toBe(true)
      expect(q.submitLog[0].extra_data.step2).toBe(true)
    })
  })

  describe('cancellation', () => {
    it('calling event.cancel() prevents the prompt from being submitted', async () => {
      const q = createQueueTrigger()
      q.on('beforeQueuePrompt', (e) => e.cancel())
      const { submitted } = await q.queuePrompt()
      expect(submitted).toBe(false)
      expect(q.submitLog).toHaveLength(0)
    })

    it('cancellation by the first handler short-circuits remaining handlers', async () => {
      const q = createQueueTrigger()
      const secondHandler = vi.fn()
      q.on('beforeQueuePrompt', (e) => e.cancel())
      q.on('beforeQueuePrompt', secondHandler)
      await q.queuePrompt()
      expect(secondHandler).not.toHaveBeenCalled()
    })
  })

  describe('programmatic trigger', () => {
    it('queuePrompt() resolves with submitted: true when not cancelled', async () => {
      const q = createQueueTrigger()
      const result = await q.queuePrompt()
      expect(result.submitted).toBe(true)
    })

    it('queuePrompt({ batchCount: 3 }) resolves with batchCount 3', async () => {
      const q = createQueueTrigger()
      const { batchCount } = await q.queuePrompt({ batchCount: 3 })
      expect(batchCount).toBe(3)
    })

    it('queuePrompt() with no args defaults to batchCount 1', async () => {
      const q = createQueueTrigger()
      const { batchCount } = await q.queuePrompt()
      expect(batchCount).toBe(1)
    })

    it('queuePrompt() fires beforeQueuePrompt handlers before submitting', async () => {
      const q = createQueueTrigger()
      const handler = vi.fn()
      q.on('beforeQueuePrompt', handler)
      await q.queuePrompt()
      expect(handler).toHaveBeenCalledOnce()
      expect(q.submitLog).toHaveLength(1)
    })
  })

  describe('Unsubscribe', () => {
    it('calling Unsubscribe removes the handler; subsequent queuePrompt calls do not invoke it', async () => {
      const q = createQueueTrigger()
      const handler = vi.fn()
      const unsub = q.on('beforeQueuePrompt', handler)
      unsub()
      await q.queuePrompt()
      expect(handler).not.toHaveBeenCalled()
    })

    it('calling Unsubscribe twice does not throw', () => {
      const q = createQueueTrigger()
      const unsub = q.on('beforeQueuePrompt', vi.fn())
      expect(() => { unsub(); unsub() }).not.toThrow()
    })
  })
})

// ── Phase B stubs ─────────────────────────────────────────────────────────────

describe('BC.19 v2 contract — beforeQueuePrompt [Phase B / shell]', () => {
  it.todo(
    '[Phase B] on("beforeQueuePrompt") fires for UI-triggered runs, not just programmatic queuePrompt() calls'
  )
  it.todo(
    '[Phase B] cancellation suppresses the actual HTTP POST to /api/prompt'
  )
  it.todo(
    '[Phase B] mutated extra_data reaches the backend in the POST body'
  )
})
