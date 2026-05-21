// Category: BC.26 — Globals as ABI (window.LiteGraph, window.comfyAPI)
// DB cross-ref: S7.G1
// blast_radius: 4.19 (compat-floor)
// v1 contract: window.LiteGraph.LGraph / window.comfyAPI.app — read from globalThis
// TODO(R8): swap with loadEvidenceSnippet once excerpts populated

import { describe, expect, it } from 'vitest'
import { countEvidenceExcerpts, loadEvidenceSnippet, runV1 } from '../harness'

void [loadEvidenceSnippet, runV1]

describe('BC.26 v1 contract — Globals as ABI (S7.G1)', () => {
  it('S7.G1 has at least one evidence excerpt', () => {
    expect(countEvidenceExcerpts('S7.G1')).toBeGreaterThan(0)
  })

  it('window.LiteGraph assigned before use is readable by extensions', () => {
    const win = {} as Record<string, unknown>
    const lg = { LGraph: class {}, LGraphNode: class {} }
    win['LiteGraph'] = lg
    expect(win['LiteGraph']).toBe(lg)
  })

  it('window.LiteGraph and the imported module export the same reference', () => {
    const importedLiteGraph = { LGraph: class {} }
    const win = {} as Record<string, unknown>
    win['LiteGraph'] = importedLiteGraph
    // Extension contract: window.LiteGraph === the module export
    expect(win['LiteGraph']).toBe(importedLiteGraph)
  })

  it('window.comfyAPI holds the api singleton', () => {
    const win = {} as Record<string, unknown>
    const api = { fetchApi: () => Promise.resolve(new Response()) }
    win['comfyAPI'] = { api }
    expect((win['comfyAPI'] as { api: typeof api }).api).toBe(api)
  })

  it('window.LiteGraph is undefined before the shim runs', () => {
    const win = {} as Record<string, unknown>
    expect(win['LiteGraph']).toBeUndefined()
  })

  it('extension can access LiteGraph.LGraph constructor from the global', () => {
    const win = {} as Record<string, unknown>
    class LGraph {}
    win['LiteGraph'] = { LGraph }
    const LG = win['LiteGraph'] as { LGraph: typeof LGraph }
    const graph = new LG.LGraph()
    expect(graph).toBeInstanceOf(LGraph)
  })

  it('window.app is the same singleton as the imported app module', () => {
    const win = {} as Record<string, unknown>
    const appSingleton = { queuePrompt: async () => ({ prompt_id: '1' }) }
    win['app'] = appSingleton
    expect(win['app']).toBe(appSingleton)
  })
})
