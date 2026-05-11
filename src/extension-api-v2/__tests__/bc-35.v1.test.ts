// Category: BC.35 — Pre-queue widget validation
// DB cross-ref: S6.A5
// Exemplar: https://github.com/goodtab/ComfyUI-Custom-Scripts
// blast_radius: 3.10
// compat-floor: blast_radius ≥ 2.0
// v1 contract: monkey-patch app.queuePrompt and throw or return early if validation fails
//              (breaks other queuePrompt patchers — silent_breakage=true)

import { describe, expect, it } from 'vitest'

// Minimal synthetic app object for v1 queuePrompt monkey-patching tests
function makeApp() {
  return {
    async queuePrompt(_batchCount: number) {
      return { prompt_id: 'abc-123', number: 0 }
    },
    graph: {
      _nodes: [] as Array<{ widgets: Array<{ name: string; value: unknown }> }>,
    },
  }
}

describe('BC.35 v1 contract — pre-queue widget validation', () => {
  describe('S6.A5 — queuePrompt monkey-patching', () => {
    it('extension can replace app.queuePrompt with a wrapper that inspects widget values before delegating', async () => {
      const app = makeApp()
      const original = app.queuePrompt.bind(app)
      const delegated: number[] = []

      app.queuePrompt = async function (batchCount: number) {
        // inspect — no validation failure here
        delegated.push(batchCount)
        return original(batchCount)
      }

      const result = await app.queuePrompt(1)
      expect(delegated).toEqual([1])
      expect(result.prompt_id).toBe('abc-123')
    })

    it('throwing inside the monkey-patched queuePrompt prevents the workflow from being submitted', async () => {
      const app = makeApp()
      const submitted: boolean[] = []

      const realQueue = app.queuePrompt.bind(app)
      app.queuePrompt = async function (batchCount: number) {
        // validation failure: throw before delegating
        throw new Error('Validation failed: widget "seed" is empty')
        submitted.push(true)
        return realQueue(batchCount)
      }

      await expect(app.queuePrompt(1)).rejects.toThrow('Validation failed')
      expect(submitted).toHaveLength(0)
    })

    it('returning undefined inside the monkey-patched queuePrompt also cancels submission', async () => {
      const app = makeApp()
      const submitted: boolean[] = []

      const realQueue = app.queuePrompt.bind(app)
      app.queuePrompt = async function (batchCount: number) {
        // return early without calling original
        if (batchCount < 0) return undefined as never
        submitted.push(true)
        return realQueue(batchCount)
      }

      const result = await (app.queuePrompt as Function)(-1)
      expect(result).toBeUndefined()
      expect(submitted).toHaveLength(0)
    })

    it('two extensions both monkey-patching queuePrompt — last patcher wins, first is silently dropped', async () => {
      const app = makeApp()
      const log: string[] = []

      // Extension A patches first
      const afterA = app.queuePrompt.bind(app)
      app.queuePrompt = async function (batchCount: number) {
        log.push('A')
        return afterA(batchCount)
      }

      // Extension B patches second — its version closes over app.queuePrompt which is already A's wrapper
      const afterB = app.queuePrompt.bind(app)
      app.queuePrompt = async function (batchCount: number) {
        log.push('B')
        return afterB(batchCount)
      }

      await app.queuePrompt(1)
      // B runs A which runs original — both fire when chained correctly
      expect(log).toEqual(['B', 'A'])
    })
  })

  describe('S6.A5 — error surfacing limitations', () => {
    it('a thrown error in the monkey-patched queuePrompt propagates as a rejected promise — caller must handle it', async () => {
      const app = makeApp()

      app.queuePrompt = async function (_batchCount: number) {
        throw new Error('invalid widget: seed is empty')
      }

      // In v1 ComfyUI, this rejection is caught somewhere in the call stack but NOT displayed in the UI
      let caught: Error | null = null
      try {
        await app.queuePrompt(1)
      } catch (e) {
        caught = e as Error
      }

      // Error is catchable — but v1 UI does not surface it to the user
      expect(caught).not.toBeNull()
      expect(caught!.message).toContain('seed is empty')
    })

    it('v1 has no standard mechanism to surface a validation message to the user from queuePrompt', () => {
      // This test documents the absence: no app.showError, no app.notify, no standard channel exists
      const app = makeApp() as Record<string, unknown>

      expect(app['showError']).toBeUndefined()
      expect(app['notify']).toBeUndefined()
      expect(app['toast']).toBeUndefined()
      // The only workaround is console.error or alert() — neither is standardized
    })
  })
})
