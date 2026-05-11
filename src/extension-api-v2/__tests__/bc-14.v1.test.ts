// Category: BC.14 — Workflow → API serialization interception (graphToPrompt)
// DB cross-ref: S6.A1
// Exemplar: https://github.com/Comfy-Org/ComfyUI-Manager/blob/main/js/components-manager.js#L781
// blast_radius: 7.02 (HIGHEST in dataset)
// compat-floor: blast_radius ≥ 2.0
// v1 contract: monkey-patch app.graphToPrompt — const orig = app.graphToPrompt.bind(app); app.graphToPrompt = async function(...args) { const r = await orig(...args); /* mutate r */ return r }
// v2 replacement: app.on('beforeGraphToPrompt', (payload) => { /* mutate payload */ }) event with cancellable/mutable payload

import { describe, expect, it } from 'vitest'
import {
  countEvidenceExcerpts,
  createMiniComfyApp,
  loadEvidenceSnippet,
  runV1
} from '../harness'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BC.14 v1 contract — graphToPrompt monkey-patch', () => {
  // ── S6.A1 evidence ───────────────────────────────────────────────────────────
  describe('S6.A1 — evidence excerpts', () => {
    it('S6.A1 has at least one evidence excerpt', () => {
      expect(countEvidenceExcerpts('S6.A1')).toBeGreaterThan(0)
    })

    it('S6.A1 evidence snippet contains graphToPrompt fingerprint', () => {
      const snippet = loadEvidenceSnippet('S6.A1', 0)
      expect(snippet).toMatch(/graphToPrompt/i)
    })

    it('S6.A1 snippet is capturable by runV1 without throwing', () => {
      const snippet = loadEvidenceSnippet('S6.A1', 0)
      const app = createMiniComfyApp()
      expect(() => runV1(snippet, { app })).not.toThrow()
    })
  })

  // ── S6.A1 synthetic behavior ─────────────────────────────────────────────────
  describe('S6.A1 — app.graphToPrompt interception', () => {
    it('extension wraps graphToPrompt and calls original; result passes through', async () => {
      const mockPrompt = {
        output: { '1': { class_type: 'KSampler', inputs: {} } },
        workflow: {}
      }
      const app = {
        graphToPrompt: async () => ({ ...mockPrompt })
      }
      // Extension wraps
      const orig = app.graphToPrompt.bind(app)
      app.graphToPrompt = async function (...args: Parameters<typeof orig>) {
        const r = await orig(...args)
        return r
      }
      const result = await app.graphToPrompt()
      expect(result.output).toEqual(mockPrompt.output)
    })

    it('mutations to the resolved prompt object are reflected in the final result', async () => {
      const mockPrompt = {
        output: { '1': { class_type: 'KSampler', inputs: {} } } as Record<string, unknown>,
        workflow: {} as Record<string, unknown>
      }
      const app = {
        graphToPrompt: async () => ({ ...mockPrompt, output: { ...mockPrompt.output } })
      }
      // Extension adds custom metadata
      const orig = app.graphToPrompt.bind(app)
      app.graphToPrompt = async function () {
        const r = await orig()
        r.output['meta'] = { custom: true } as unknown as (typeof r.output)[string]
        return r
      }
      const result = await app.graphToPrompt()
      expect((result.output['meta'] as Record<string, unknown>).custom).toBe(true)
    })

    it('multiple wrappers in sequence each see prior mutations', async () => {
      const base = {
        output: { '1': { class_type: 'KSampler', inputs: {} } } as Record<string, unknown>,
        workflow: {} as Record<string, unknown>
      }
      const app = {
        graphToPrompt: async () => ({ ...base, output: { ...base.output } })
      }

      // Extension A wraps first
      const origA = app.graphToPrompt.bind(app)
      app.graphToPrompt = async function () {
        const r = await origA()
        r.output['fromA'] = true as unknown as (typeof r.output)[string]
        return r
      }
      // Extension B wraps second (outermost)
      const origB = app.graphToPrompt.bind(app)
      app.graphToPrompt = async function () {
        const r = await origB()
        r.output['fromB'] = true as unknown as (typeof r.output)[string]
        return r
      }

      const result = await app.graphToPrompt()
      // Both extensions should have contributed
      expect(result.output['fromA']).toBe(true)
      expect(result.output['fromB']).toBe(true)
    })

    it('wrapper receives same args passed by caller (args pass-through)', async () => {
      const receivedArgs: unknown[][] = []
      const app = {
        graphToPrompt: async (...args: unknown[]) => {
          receivedArgs.push(args)
          return { output: {}, workflow: {} }
        }
      }
      const orig = app.graphToPrompt.bind(app)
      app.graphToPrompt = async function (...args: Parameters<typeof orig>) {
        return orig(...args)
      }
      // Call with no args — the wrapper must pass them through unchanged
      await app.graphToPrompt()
      expect(receivedArgs).toHaveLength(1)
    })

    it.todo(
      'virtual node resolution: virtual nodes resolved by the extension wrapper are absent from the serialized output sent to the backend'
    )

    it.todo(
      'full queuePrompt: custom metadata injected into prompt.output is preserved through the full queuePrompt call'
    )

    it.todo(
      'real graphToPrompt implementation: multiple extensions wrapping graphToPrompt via real app wiring all fire in correct order'
    )
  })
})
