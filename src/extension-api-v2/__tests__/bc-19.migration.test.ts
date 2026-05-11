// Category: BC.19 — Workflow execution trigger
// DB cross-ref: S6.A4
// blast_radius: 6.09 (compat-floor)
// Migration: v1 app.queuePrompt monkey-patch → v2 comfyApp.on('beforeQueuePrompt') + comfyApp.queuePrompt(opts)
//
// Phase A strategy: prove that v1 wrapper pattern (replace queuePrompt, call
// orig selectively) and v2 beforeQueuePrompt (event.cancel / event.payload
// mutation) produce structurally equivalent outcomes on synthetic prompts.
// Real HTTP submission is todo(Phase B).
//
// I-TF.8.D2 — BC.19 migration wired assertions.

import { describe, expect, it, vi } from 'vitest'

// ── V1 app shim with patchable queuePrompt ────────────────────────────────────

function createV1App() {
  const submitLog: unknown[] = []
  let _queuePrompt = async (payload: unknown) => { submitLog.push(payload) }

  return {
    get queuePrompt() { return _queuePrompt },
    set queuePrompt(fn: (payload: unknown) => Promise<void>) { _queuePrompt = fn },
    get submitLog() { return submitLog },
    async callQueue(payload: unknown) { return _queuePrompt(payload) }
  }
}

// ── V2 queue trigger (same as bc-19.v2 shape) ────────────────────────────────

function createV2QueueTrigger() {
  const handlers: Array<(e: { payload: Record<string, unknown>; cancel(): void }) => void> = []
  const submitLog: unknown[] = []

  function on(_evt: 'beforeQueuePrompt', h: (e: { payload: Record<string, unknown>; cancel(): void }) => void) {
    handlers.push(h)
    return () => { const i = handlers.indexOf(h); if (i !== -1) handlers.splice(i, 1) }
  }

  async function queuePrompt(opts: { batchCount?: number } = {}) {
    let cancelled = false
    const payload: Record<string, unknown> = { prompt: {}, extra_data: { extra_pnginfo: {} } }
    const evt = { payload, cancel() { cancelled = true } }
    for (const h of [...handlers]) { h(evt); if (cancelled) break }
    if (!cancelled) submitLog.push({ ...evt.payload, batchCount: opts.batchCount ?? 1 })
    return { submitted: !cancelled }
  }

  return { on, queuePrompt, submitLog }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BC.19 migration — workflow execution trigger', () => {
  describe('payload mutation equivalence', () => {
    it('v1 wrapper mutation and v2 event.payload mutation both alter the queued payload', async () => {
      const v1 = createV1App()
      const v2 = createV2QueueTrigger()

      // v1: wrap queuePrompt to inject auth token
      const origV1 = v1.queuePrompt
      v1.queuePrompt = async (payload: unknown) => {
        const p = payload as Record<string, unknown>
        p.auth_token = 'tok-v1'
        return origV1(p)
      }

      // v2: inject via beforeQueuePrompt handler
      v2.on('beforeQueuePrompt', (e) => { e.payload.auth_token = 'tok-v2' })

      await v1.callQueue({ prompt: {}, extra_data: {} })
      await v2.queuePrompt()

      const v1Submitted = v1.submitLog[0] as Record<string, unknown>
      const v2Submitted = v2.submitLog[0] as Record<string, unknown>

      expect(v1Submitted.auth_token).toBe('tok-v1')
      expect(v2Submitted.auth_token).toBe('tok-v2')
      // Both injected an auth_token — structurally equivalent
      expect(typeof v1Submitted.auth_token).toBe(typeof v2Submitted.auth_token)
    })
  })

  describe('cancellation equivalence', () => {
    it('v1 no-call-orig wrapper and v2 event.cancel() both suppress the submit', async () => {
      const v1 = createV1App()
      const v2 = createV2QueueTrigger()

      // v1: wrapper that swallows the call (does not call orig)
      v1.queuePrompt = async (_payload: unknown) => { /* suppressed */ }

      // v2: cancel via event
      v2.on('beforeQueuePrompt', (e) => e.cancel())

      await v1.callQueue({ prompt: {} })
      const { submitted } = await v2.queuePrompt()

      expect(v1.submitLog).toHaveLength(0)
      expect(submitted).toBe(false)
      expect(v2.submitLog).toHaveLength(0)
    })
  })

  describe('programmatic trigger equivalence', () => {
    it('v1 direct app.queuePrompt(payload) and v2 comfyApp.queuePrompt() both trigger a submit', async () => {
      const v1 = createV1App()
      const v2 = createV2QueueTrigger()

      await v1.callQueue({ prompt: {}, extra_data: {} })
      const { submitted } = await v2.queuePrompt()

      expect(v1.submitLog).toHaveLength(1)
      expect(submitted).toBe(true)
      expect(v2.submitLog).toHaveLength(1)
    })
  })

  describe('handler registration count', () => {
    it('v1 replaces the handler each time (one active); v2 accumulates handlers (additive)', async () => {
      const v1 = createV1App()
      const v2 = createV2QueueTrigger()
      const v1Calls: number[] = []
      const v2Calls: number[] = []

      // v1: each assignment replaces
      v1.queuePrompt = async (p) => { v1Calls.push(1); return }
      v1.queuePrompt = async (p) => { v1Calls.push(2); return }
      await v1.callQueue({})
      // Only the second (latest) assignment fires
      expect(v1Calls).toEqual([2])

      // v2: both handlers fire
      v2.on('beforeQueuePrompt', () => v2Calls.push(1))
      v2.on('beforeQueuePrompt', () => v2Calls.push(2))
      await v2.queuePrompt()
      expect(v2Calls).toEqual([1, 2])
    })
  })
})

// ── Phase B stubs ─────────────────────────────────────────────────────────────

describe('BC.19 migration — workflow execution trigger [Phase B / shell]', () => {
  it.todo(
    '[Phase B] v1 monkey-patch and v2 beforeQueuePrompt both fire for UI-triggered runs (toolbar Run button)'
  )
  it.todo(
    '[Phase B] a v1 monkey-patch and a v2 beforeQueuePrompt handler active simultaneously do not double-submit'
  )
  it.todo(
    '[Phase B] mutated payload in v2 reaches the backend in the POST body to /api/prompt'
  )
})
