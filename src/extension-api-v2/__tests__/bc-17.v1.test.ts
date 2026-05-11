// Category: BC.17 — Backend execution lifecycle and progress events
// DB cross-ref: S5.A1, S5.A2, S5.A3
// blast_radius: 5.00 (compat-floor)
// v1 contract: api.addEventListener('executed'|'progress'|'executing', fn)
// TODO(R8): swap with loadEvidenceSnippet once excerpts populated

import { describe, expect, it } from 'vitest'
import { countEvidenceExcerpts, loadEvidenceSnippet, runV1 } from '../harness'

void [loadEvidenceSnippet, runV1]

function makeApi() {
  const listeners = new Map<string, Array<(e: { detail: unknown }) => void>>()
  return {
    addEventListener(event: string, fn: (e: { detail: unknown }) => void) {
      if (!listeners.has(event)) listeners.set(event, [])
      listeners.get(event)!.push(fn)
    },
    _emit(event: string, detail: unknown) {
      listeners.get(event)?.forEach(fn => fn({ detail }))
    },
  }
}

describe('BC.17 v1 contract — backend execution lifecycle events (S5.A1/A2/A3)', () => {
  it('S5.A1 has at least one evidence excerpt', () => {
    expect(countEvidenceExcerpts('S5.A1')).toBeGreaterThan(0)
  })

  it("addEventListener('executed') fires with detail.node and detail.output", () => {
    const api = makeApi()
    let detail: unknown
    api.addEventListener('executed', e => { detail = e.detail })
    api._emit('executed', { node: '5', output: { images: [] } })
    expect((detail as { node: string }).node).toBe('5')
  })

  it("addEventListener('progress') fires with detail.value and detail.max", () => {
    const api = makeApi()
    let detail: unknown
    api.addEventListener('progress', e => { detail = e.detail })
    api._emit('progress', { value: 3, max: 10 })
    expect((detail as { value: number; max: number }).value).toBe(3)
    expect((detail as { value: number; max: number }).max).toBe(10)
  })

  it("addEventListener('executing') fires with currently-running node id", () => {
    const api = makeApi()
    const ids: unknown[] = []
    api.addEventListener('executing', e => ids.push((e.detail as { node: string }).node))
    api._emit('executing', { node: '7' })
    expect(ids).toEqual(['7'])
  })

  it('multiple listeners on the same event all fire', () => {
    const api = makeApi()
    const log: number[] = []
    api.addEventListener('executed', () => log.push(1))
    api.addEventListener('executed', () => log.push(2))
    api._emit('executed', {})
    expect(log).toEqual([1, 2])
  })
})
