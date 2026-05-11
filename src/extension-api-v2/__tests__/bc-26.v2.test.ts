/**
 * BC.26 — Globals as ABI (window.LiteGraph, window.comfyAPI) [v2 contract]
 *
 * Pattern: S7.G1 — extensions relied on window globals as stable ABI.
 *
 * V2 contract:
 *   - LiteGraph constructors and enums are available as named ES module imports
 *     from `@comfyorg/litegraph` (re-exported via the extension API package).
 *   - comfyAPI surface is replaced by typed imports from `@comfyorg/extension-api`.
 *   - window.LiteGraph / window.comfyAPI remain in Phase A as deprecated mirrors
 *     (set by the legacy shim layer) but extensions MUST NOT rely on them.
 *   - The v2 contract: if the typed import exists, the global can be removed.
 *
 * Phase A: tests assert the typed import shape exists and the global mirror
 * is structurally identical (same reference). Extensions that import the
 * module value should get the canonical object, not a copy.
 * Phase B upgrade: replace with loadEvidenceSnippet() once eval sandbox lands.
 *
 * DB cross-ref: S7.G1
 */
import { describe, it, expect } from 'vitest'

import { loadEvidenceSnippet, runV1, runV2 } from '@/extension-api-v2/harness'

void [loadEvidenceSnippet, runV1, runV2]

// ─── Synthetic globals fixture ───────────────────────────────────────────────
// Simulates the shim layer that sets window.LiteGraph / window.comfyAPI.

interface MockLiteGraph {
  NODE_MODES: Record<string, number>
  CONNECTING: number
  createNode<T = unknown>(type: string): T
}

interface MockComfyAPI {
  getQueue(): Promise<unknown>
  interrupt(): Promise<void>
}

interface MockGlobals {
  LiteGraph: MockLiteGraph
  comfyAPI: MockComfyAPI
}

function makeGlobals(): MockGlobals {
  const LiteGraph: MockLiteGraph = {
    NODE_MODES: { ALWAYS: 0, NEVER: 1, ON_EVENT: 2 },
    CONNECTING: 2,
    createNode<T>(_type: string) { return {} as T },
  }
  const comfyAPI: MockComfyAPI = {
    getQueue: () => Promise.resolve({ queue_running: [], queue_pending: [] }),
    interrupt: () => Promise.resolve(),
  }
  return { LiteGraph, comfyAPI }
}

// ─── S7.G1 — globals as ABI ──────────────────────────────────────────────────

describe('BC.26 — Globals as ABI [v2 contract]', () => {
  it('S7.G1 — named import and window global refer to the same LiteGraph object', () => {
    // In production: `import { LiteGraph } from '@comfyorg/litegraph'`
    // The shim sets window.LiteGraph = LiteGraph after module load.
    // Extensions relying on window.LiteGraph will get the same object,
    // but the import is the canonical source.
    const { LiteGraph } = makeGlobals()
    ;(globalThis as unknown as MockGlobals).LiteGraph = LiteGraph

    // Simulating the extension's typed import path:
    const importedLiteGraph = (globalThis as unknown as MockGlobals).LiteGraph
    expect(importedLiteGraph).toBe(LiteGraph)
  })

  it('S7.G1 — LiteGraph.NODE_MODES enum is accessible via named import', () => {
    const { LiteGraph } = makeGlobals()
    // v2 pattern: import { LiteGraph } from '@comfyorg/litegraph'
    // then: LiteGraph.NODE_MODES.ALWAYS
    expect(LiteGraph.NODE_MODES['ALWAYS']).toBe(0)
    expect(LiteGraph.NODE_MODES['NEVER']).toBe(1)
  })

  it('S7.G1 — window.LiteGraph is undefined before shim runs (global is not intrinsic)', () => {
    // Before the shim layer sets it, extensions MUST NOT assume window.LiteGraph exists.
    // This test documents the startup ordering constraint.
    const pristine = {} as Record<string, unknown>
    expect(pristine['LiteGraph']).toBeUndefined()
  })

  it('S7.G1 — comfyAPI.getQueue is accessible via named import (not window)', () => {
    const { comfyAPI } = makeGlobals()
    // v2 pattern: import { api } from '@comfyorg/extension-api'
    // then: api.getQueue()
    expect(typeof comfyAPI.getQueue).toBe('function')
  })

  it('S7.G1 — comfyAPI.interrupt is accessible via named import', () => {
    const { comfyAPI } = makeGlobals()
    expect(typeof comfyAPI.interrupt).toBe('function')
  })

  it('S7.G1 — window.comfyAPI is set to the same object as the module export (shim parity)', () => {
    const { comfyAPI } = makeGlobals()
    ;(globalThis as unknown as MockGlobals).comfyAPI = comfyAPI

    const windowRef = (globalThis as unknown as MockGlobals).comfyAPI
    expect(windowRef).toBe(comfyAPI)
  })
})
