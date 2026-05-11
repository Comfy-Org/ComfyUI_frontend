// Category: BC.19 — Workflow execution trigger
// DB cross-ref: S6.A4
// Exemplar: https://github.com/MajoorWaldi/ComfyUI-Majoor-AssetsManager/blob/main/js/features/viewer/workflowSidebar/sidebarRunButton.js#L317
// blast_radius: 6.09 (compat-floor)
// compat-floor: blast_radius ≥ 2.0
// v1 contract: const orig = app.queuePrompt.bind(app); app.queuePrompt = async function(num, batchCount) { return orig(num, batchCount) }

import { describe, expect, it, vi } from 'vitest'

// ── Minimal app.queuePrompt shim ─────────────────────────────────────────────
// Models the v1 monkey-patch pattern without a real ComfyUI app object.

interface MockApp {
  queuePrompt: (number: number, batchCount: number) => Promise<{ queued: boolean }>
}

function createMockApp(): MockApp {
  return {
    async queuePrompt(number: number, batchCount: number) {
      return { queued: true }
    }
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BC.19 v1 contract — app.queuePrompt monkey-patch', () => {
  describe('S6.A4 — queuePrompt interception (synthetic)', () => {
    it('wrapper replaces app.queuePrompt and delegates to the original', async () => {
      const app = createMockApp()
      const origCalls: [number, number][] = []
      const orig = app.queuePrompt.bind(app)

      // v1 pattern: capture and delegate
      app.queuePrompt = async function (number, batchCount) {
        origCalls.push([number, batchCount])
        return orig(number, batchCount)
      }

      const result = await app.queuePrompt(0, 1)

      expect(origCalls).toHaveLength(1)
      expect(origCalls[0]).toEqual([0, 1])
      expect(result.queued).toBe(true)
    })

    it('wrapper receives (number, batchCount) arguments matching the call signature', async () => {
      const app = createMockApp()
      let capturedArgs: [number, number] | undefined

      const orig = app.queuePrompt.bind(app)
      app.queuePrompt = async function (number, batchCount) {
        capturedArgs = [number, batchCount]
        return orig(number, batchCount)
      }

      await app.queuePrompt(2, 4)

      expect(capturedArgs).toEqual([2, 4])
    })

    it('extension can prevent execution by not calling orig() inside the wrapper', async () => {
      const app = createMockApp()
      const origSpy = vi.fn().mockResolvedValue({ queued: true })
      app.queuePrompt = origSpy

      const orig = origSpy.bind(app)
      let blocked = false

      // Extension wrapper: conditionally blocks
      app.queuePrompt = async function (number, batchCount) {
        if (batchCount === 0) {
          blocked = true
          return { queued: false } // never calls orig
        }
        return orig(number, batchCount)
      }

      const result = await app.queuePrompt(0, 0)

      expect(blocked).toBe(true)
      expect(origSpy).not.toHaveBeenCalled()
      expect(result.queued).toBe(false)
    })

    it('multiple extensions wrapping queuePrompt execute in wrapping order (LIFO)', async () => {
      const app = createMockApp()
      const callOrder: string[] = []

      const orig0 = app.queuePrompt.bind(app)
      app.queuePrompt = async function (n, b) {
        callOrder.push('ext-A-pre')
        const r = await orig0(n, b)
        callOrder.push('ext-A-post')
        return r
      }

      const orig1 = app.queuePrompt.bind(app)
      app.queuePrompt = async function (n, b) {
        callOrder.push('ext-B-pre')
        const r = await orig1(n, b)
        callOrder.push('ext-B-post')
        return r
      }

      await app.queuePrompt(0, 1)

      // LIFO: B wraps A — B-pre fires first, then A-pre, then A-post, then B-post
      expect(callOrder).toEqual(['ext-B-pre', 'ext-A-pre', 'ext-A-post', 'ext-B-post'])
    })

    it('extension can inject a field into a mutable prompt object before calling orig()', async () => {
      const app = createMockApp()
      const prompts: Record<string, unknown>[] = []

      // Simulate a version of app where queuePrompt receives a prompt object
      interface AppWithPrompt {
        queuePrompt: (prompt: Record<string, unknown>) => Promise<{ queued: boolean }>
      }
      const appExt: AppWithPrompt = {
        async queuePrompt(prompt) {
          prompts.push(prompt)
          return { queued: true }
        }
      }

      const origExt = appExt.queuePrompt.bind(appExt)
      appExt.queuePrompt = async function (prompt) {
        // v1 pattern: inject auth field before delegating
        prompt['__auth'] = 'my-token'
        return origExt(prompt)
      }

      await appExt.queuePrompt({ node_1: { class_type: 'KSampler' } })

      expect(prompts[0]['__auth']).toBe('my-token')
    })
  })

  describe('Phase B deferred', () => {
    it.todo(
      'programmatic call to app.queuePrompt(0, 1) from an extension correctly enqueues the current graph and the server receives the prompt (Phase B — requires real ComfyUI API connection)'
    )
  })
})
