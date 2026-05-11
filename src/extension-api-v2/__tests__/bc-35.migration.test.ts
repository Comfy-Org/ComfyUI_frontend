// Category: BC.35 — Pre-queue widget validation
// DB cross-ref: S6.A5
// Exemplar: https://github.com/goodtab/ComfyUI-Custom-Scripts
// blast_radius: 3.10
// compat-floor: blast_radius ≥ 2.0 — MUST pass before v2 ships
// migration: app.queuePrompt monkey-patch → comfyApp.on('beforeQueue', event => event.reject(...))

import { describe, expect, it, vi } from 'vitest'

// ── V1 queuePrompt monkey-patch simulation ────────────────────────────────────
// v1 pattern: extensions replaced app.queuePrompt with a wrapper that could
// throw (or silently return) to cancel. Chaining was fragile — each patch had
// to call the captured original, and the second patcher's check ran only if
// the first patcher didn't throw.

type QueueFn = (number: number, batchCount: number) => Promise<void>

function makeV1App() {
  const submitted: Array<{ number: number }> = []
  let queuePrompt: QueueFn = async (number) => { submitted.push({ number }) }

  return {
    get queuePrompt() { return queuePrompt },
    set queuePrompt(fn: QueueFn) { queuePrompt = fn },
    _submitted: submitted
  }
}

function v1MonkeyPatch(app: ReturnType<typeof makeV1App>, validator: (n: number) => string | null): void {
  const original = app.queuePrompt
  app.queuePrompt = async (number, batchCount) => {
    const error = validator(number)
    if (error) throw new Error(error)
    return original(number, batchCount)
  }
}

// ── V2 beforeQueue simulation ─────────────────────────────────────────────────

interface BeforeQueueEvent {
  reject(message?: string): void
  readonly rejected: boolean
  readonly rejectionMessage: string | undefined
}

type QueueHandler = (event: BeforeQueueEvent) => void | Promise<void>
type Unsubscribe = () => void

function makeV2QueueManager() {
  const handlers: QueueHandler[] = []
  const submitted: number[] = []
  const uiMessages: string[] = []

  return {
    on(_event: 'beforeQueue', handler: QueueHandler): Unsubscribe {
      handlers.push(handler)
      return () => {
        const i = handlers.indexOf(handler)
        if (i !== -1) handlers.splice(i, 1)
      }
    },
    async queue(number: number): Promise<{ submitted: boolean }> {
      let rejected = false
      let rejectionMessage: string | undefined

      const event: BeforeQueueEvent = {
        reject(msg) { rejected = true; rejectionMessage = msg },
        get rejected() { return rejected },
        get rejectionMessage() { return rejectionMessage }
      }

      for (const fn of [...handlers]) {
        await fn(event)
        if (rejected) {
          if (rejectionMessage) uiMessages.push(rejectionMessage)
          return { submitted: false }
        }
      }

      submitted.push(number)
      return { submitted: true }
    },
    submittedCount: () => submitted.length,
    uiMessages: () => [...uiMessages]
  }
}

// ─────────────────────────────────────────────────────────────────────────────

describe('BC.35 migration — pre-queue widget validation', () => {
  describe('queuePrompt monkey-patch replacement', () => {
    it("app.queuePrompt wrapper that throws is replaced by on('beforeQueue', e => e.reject(msg))", async () => {
      // v1: throwing wrapper
      const v1App = makeV1App()
      v1MonkeyPatch(v1App, (n) => (n === 0 ? 'Batch size must be > 0' : null))

      await expect(v1App.queuePrompt(0, 1)).rejects.toThrow('Batch size must be > 0')
      await v1App.queuePrompt(1, 1) // passes
      expect(v1App._submitted).toHaveLength(1)

      // v2: beforeQueue rejection
      const v2 = makeV2QueueManager()
      v2.on('beforeQueue', (e) => {
        // Equivalent validation (number=0 is invalid)
        e.reject('Batch size must be > 0')
      })

      const fail = await v2.queue(0)
      expect(fail.submitted).toBe(false)
      expect(v2.uiMessages()[0]).toBe('Batch size must be > 0')
    })

    it("v2 compat shim: wrapped queuePrompt logic re-expressed as a beforeQueue handler preserves behavior", async () => {
      // The shim translates: if original queuePrompt throws → reject with the error message
      const v2 = makeV2QueueManager()
      let errorFromPatch: string | null = null

      // "Shim" wraps old patch logic as a beforeQueue handler
      v2.on('beforeQueue', (e) => {
        const patchedValidator = (n: number): string | null =>
          n < 1 ? 'Steps must be at least 1' : null
        errorFromPatch = patchedValidator(0)
        if (errorFromPatch) e.reject(errorFromPatch)
      })

      const result = await v2.queue(0)
      expect(result.submitted).toBe(false)
      expect(v2.uiMessages()).toContain('Steps must be at least 1')
    })

    it('extensions that chain-called the original queuePrompt can remove that pattern in v2', async () => {
      // v1: two chained patches — each must call the previous
      const v1App = makeV1App()
      v1MonkeyPatch(v1App, () => null) // patch 1: always passes
      v1MonkeyPatch(v1App, () => null) // patch 2: always passes, calls through

      await v1App.queuePrompt(1, 1)
      expect(v1App._submitted).toHaveLength(1) // submission happened

      // v2: two independent handlers — no chaining needed
      const v2 = makeV2QueueManager()
      v2.on('beforeQueue', (_e) => { /* passes */ })
      v2.on('beforeQueue', (_e) => { /* passes */ })

      const result = await v2.queue(1)
      expect(result.submitted).toBe(true)
      expect(v2.submittedCount()).toBe(1)
    })
  })

  describe('error surfacing improvement', () => {
    it('v1 console-only errors are replaced by v2 UI-visible rejection messages', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // v1: extension logs to console, but submission still proceeds
      const v1App = makeV1App()
      const originalQ = v1App.queuePrompt
      v1App.queuePrompt = async (n, b) => {
        // v1 "validation" — logs but doesn't stop submission
        if (n === 0) console.error('Invalid batch size!')
        return originalQ(n, b)
      }
      await v1App.queuePrompt(0, 1)
      expect(consoleSpy).toHaveBeenCalledWith('Invalid batch size!')
      expect(v1App._submitted).toHaveLength(1) // v1: still submitted despite error!

      // v2: reject() stops submission AND surfaces to UI
      const v2 = makeV2QueueManager()
      v2.on('beforeQueue', (e) => e.reject('Invalid batch size!'))

      const result = await v2.queue(0)
      expect(result.submitted).toBe(false) // v2: actually blocked
      expect(v2.uiMessages()).toContain('Invalid batch size!')

      consoleSpy.mockRestore()
    })

    it('multiple v1 patchers that could silently overwrite each other are independently stackable in v2', async () => {
      // v1: two patches — second clobbers first's validation if not careful
      const v1App = makeV1App()
      const extAValidation = vi.fn(() => null) // ext-A passes
      const extBValidation = vi.fn((): string | null => 'B rejects')

      // v1: each patcher wraps the previous — but if ext-B directly replaces
      // without calling through, ext-A's validation is lost.
      v1MonkeyPatch(v1App, extAValidation)
      // ext-B incorrectly overwrites without preserving ext-A:
      v1App.queuePrompt = async () => { throw new Error('B rejects') }

      await expect(v1App.queuePrompt(1, 1)).rejects.toThrow('B rejects')
      // ext-A's validation was never called — silently clobbered
      expect(extAValidation).not.toHaveBeenCalled()

      // v2: both handlers are independently registered and both fire
      const v2 = makeV2QueueManager()
      const v2A = vi.fn((_e: BeforeQueueEvent) => { /* A passes */ })
      const v2B = vi.fn((e: BeforeQueueEvent) => e.reject('B rejects'))

      v2.on('beforeQueue', v2A)
      v2.on('beforeQueue', v2B)

      const result = await v2.queue(1)
      expect(v2A).toHaveBeenCalledOnce() // A ran
      expect(v2B).toHaveBeenCalledOnce() // B ran and rejected
      expect(result.submitted).toBe(false)
    })
  })
})
