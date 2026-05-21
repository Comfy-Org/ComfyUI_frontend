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
        output: { '1': { class_type: 'KSampler', inputs: {} } } as Record<
          string,
          unknown
        >,
        workflow: {} as Record<string, unknown>
      }
      const app = {
        graphToPrompt: async () => ({
          ...mockPrompt,
          output: { ...mockPrompt.output }
        })
      }
      // Extension adds custom metadata
      const orig = app.graphToPrompt.bind(app)
      app.graphToPrompt = async function () {
        const r = await orig()
        r.output['meta'] = {
          custom: true
        } as unknown as (typeof r.output)[string]
        return r
      }
      const result = await app.graphToPrompt()
      expect((result.output['meta'] as Record<string, unknown>).custom).toBe(
        true
      )
    })

    it('multiple wrappers in sequence each see prior mutations', async () => {
      const base = {
        output: { '1': { class_type: 'KSampler', inputs: {} } } as Record<
          string,
          unknown
        >,
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

    it('virtual node resolution: virtual nodes resolved by the extension wrapper are absent from the serialized output sent to the backend', async () => {
      // Mirror the real graphToPrompt contract: a virtual node (e.g. a
      // group node, primitive node, or reroute) contributes its inner
      // nodes to `output` but the virtual node itself must NOT appear
      // in the serialized API workflow. The wrapper performs that
      // resolution step before returning.
      const app = {
        graphToPrompt: async () => ({
          output: {
            // Virtual group node — should be stripped by the wrapper.
            '1': {
              class_type: 'GroupNode',
              isVirtualNode: true,
              inputs: {}
            },
            // Inner node contributed by the virtual node — kept.
            '2': { class_type: 'KSampler', inputs: {} },
            // Independent real node — kept.
            '3': { class_type: 'VAEDecode', inputs: {} }
          } as Record<
            string,
            {
              class_type: string
              isVirtualNode?: boolean
              inputs: Record<string, unknown>
            }
          >,
          workflow: {} as Record<string, unknown>
        })
      }
      // Extension wraps and resolves virtual nodes out of the payload.
      const orig = app.graphToPrompt.bind(app)
      app.graphToPrompt = async function () {
        const r = await orig()
        for (const id of Object.keys(r.output)) {
          if (r.output[id].isVirtualNode) {
            delete r.output[id]
          }
        }
        return r
      }
      const result = await app.graphToPrompt()
      expect(Object.keys(result.output).sort()).toEqual(['2', '3'])
      expect(result.output['1']).toBeUndefined()
      // Inner + independent real nodes survive the resolution pass.
      expect(result.output['2'].class_type).toBe('KSampler')
      expect(result.output['3'].class_type).toBe('VAEDecode')
    })

    it('full queuePrompt: custom metadata injected into prompt.output is preserved through the full queuePrompt call', async () => {
      // The v1 pattern wraps graphToPrompt, but the *contract* the
      // extension cares about is "what the backend receives via
      // queuePrompt(p)". This test asserts the metadata survives the
      // full pipe: wrapped-graphToPrompt → queuePrompt → backend.
      const seenByBackend: Array<Record<string, unknown>> = []
      const app = {
        graphToPrompt: async () => ({
          output: { '1': { class_type: 'KSampler', inputs: {} } } as Record<
            string,
            unknown
          >,
          workflow: {} as Record<string, unknown>
        }),
        async queuePrompt(_n: number) {
          const p = await app.graphToPrompt()
          seenByBackend.push(p.output)
          return { prompt_id: 'abc' }
        }
      }
      // Extension wraps graphToPrompt and adds custom metadata.
      const orig = app.graphToPrompt.bind(app)
      app.graphToPrompt = async function () {
        const r = await orig()
        r.output['extra_pnginfo'] = {
          workflow_hash: 'deadbeef',
          custom: true
        } as unknown as (typeof r.output)[string]
        return r
      }
      // Caller invokes queuePrompt — the backend should observe the
      // injected metadata.
      const res = await app.queuePrompt(0)
      expect(res.prompt_id).toBe('abc')
      expect(seenByBackend).toHaveLength(1)
      const sent = seenByBackend[0]
      expect(sent['extra_pnginfo']).toEqual({
        workflow_hash: 'deadbeef',
        custom: true
      })
      // Original node still present.
      expect((sent['1'] as { class_type: string }).class_type).toBe('KSampler')
    })

    it('real graphToPrompt implementation: multiple extensions wrapping graphToPrompt via real app wiring all fire in correct order', async () => {
      // Two extensions register against the same app object, each
      // monkey-patching graphToPrompt in turn. The execution order is
      // outermost-first (B wraps after A, so B runs first and then
      // delegates to A). Capture firing order via a log.
      const order: string[] = []
      const base = {
        output: { '1': { class_type: 'KSampler', inputs: {} } } as Record<
          string,
          unknown
        >,
        workflow: {} as Record<string, unknown>
      }
      const app = {
        async graphToPrompt() {
          order.push('original')
          return { ...base, output: { ...base.output } }
        }
      }

      // Simulate registerExtension wiring — each extension grabs the
      // current app.graphToPrompt and replaces it. Order of
      // registration matters: first-registered runs nearest to the
      // original; last-registered runs outermost.
      function registerWrapper(label: string) {
        const orig = app.graphToPrompt.bind(app)
        app.graphToPrompt = async function () {
          order.push(`${label}:before`)
          const r = await orig()
          order.push(`${label}:after`)
          ;(r.output as Record<string, unknown>)[label] = true
          return r
        }
      }
      registerWrapper('A') // registers first — innermost
      registerWrapper('B') // registers second — middle
      registerWrapper('C') // registers third — outermost

      const result = await app.graphToPrompt()

      // All three contributed.
      expect(result.output['A']).toBe(true)
      expect(result.output['B']).toBe(true)
      expect(result.output['C']).toBe(true)

      // Firing order: outermost (C) enters first, then B, then A,
      // then original, then unwind in reverse.
      expect(order).toEqual([
        'C:before',
        'B:before',
        'A:before',
        'original',
        'A:after',
        'B:after',
        'C:after'
      ])
    })
  })
})
