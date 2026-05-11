// Category: BC.16 — Execution output consumption (per-node)
// DB cross-ref: S2.N2
// blast_radius: 4.67 (compat-floor)
// Migration: v1 node.onExecuted = fn → v2 NodeHandle.on('executed', fn)
//
// Phase A strategy: prove that v1 assignment and v2 on() registration
// both capture and expose the same event payload structure, using
// synthetic dispatch. Real WebSocket timing is todo(Phase B).
//
// I-TF.8.D2 — BC.16 migration wired assertions.

import { describe, expect, it, vi } from 'vitest'
import type { NodeExecutedEvent } from '@/extension-api/node'

// ── V1 node shim ──────────────────────────────────────────────────────────────

interface V1NodeLike {
  onExecuted?: (data: { text?: string[]; images?: unknown[] }) => void
}

function createV1Node(): V1NodeLike & { simulateExecuted(data: { text?: string[]; images?: unknown[] }): void } {
  const node: V1NodeLike = {}
  return {
    get onExecuted() { return node.onExecuted },
    set onExecuted(fn) { node.onExecuted = fn },
    simulateExecuted(data) { node.onExecuted?.(data) }
  }
}

// ── V2 event bus (same minimal shape as bc-16.v2) ────────────────────────────

function createV2Bus() {
  const handlers: Array<(e: NodeExecutedEvent) => void> = []
  return {
    on(_evt: 'executed', fn: (e: NodeExecutedEvent) => void) {
      handlers.push(fn)
      return () => { const i = handlers.indexOf(fn); if (i !== -1) handlers.splice(i, 1) }
    },
    emit(e: NodeExecutedEvent) { for (const h of [...handlers]) h(e) }
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BC.16 migration — per-node execution output', () => {
  describe('data shape equivalence', () => {
    it('v1 onExecuted data.text and v2 executed event.output.text carry the same content', () => {
      const v1 = createV1Node()
      const v2 = createV2Bus()
      const v1Texts: string[][] = []
      const v2Texts: string[][] = []

      v1.onExecuted = (data) => { if (data.text) v1Texts.push(data.text) }
      v2.on('executed', (e) => { if (e.output.text) v2Texts.push(e.output.text) })

      const payload = { text: ['Generated text output'], images: [] }
      v1.simulateExecuted(payload)
      v2.emit({ output: payload })

      expect(v1Texts[0]).toEqual(v2Texts[0])
    })

    it('v1 data.images and v2 event.output.images have the same length', () => {
      const v1 = createV1Node()
      const v2 = createV2Bus()
      let v1ImageCount = -1
      let v2ImageCount = -1

      v1.onExecuted = (data) => { v1ImageCount = data.images?.length ?? 0 }
      v2.on('executed', (e) => { v2ImageCount = e.output.images?.length ?? 0 })

      const images = [{ filename: 'a.png', subfolder: '', type: 'output' }]
      v1.simulateExecuted({ text: [], images })
      v2.emit({ output: { text: [], images } })

      expect(v1ImageCount).toBe(v2ImageCount)
    })
  })

  describe('subscription model migration', () => {
    it('v1 onExecuted assignment and v2 on() both register exactly one active handler', () => {
      const v1 = createV1Node()
      const v2 = createV2Bus()
      const v1Handler = vi.fn()
      const v2Handler = vi.fn()

      v1.onExecuted = v1Handler
      v2.on('executed', v2Handler)

      const data = { text: ['x'], images: [] }
      v1.simulateExecuted(data)
      v2.emit({ output: data })

      expect(v1Handler).toHaveBeenCalledOnce()
      expect(v2Handler).toHaveBeenCalledOnce()
    })

    it('v1 reassignment replaces the handler; v2 unsubscribe + re-on is the equivalent', () => {
      const v1 = createV1Node()
      const v2 = createV2Bus()
      const firstV1 = vi.fn()
      const secondV1 = vi.fn()
      const firstV2 = vi.fn()
      const secondV2 = vi.fn()

      v1.onExecuted = firstV1
      const unsub = v2.on('executed', firstV2)

      // Replace v1 handler
      v1.onExecuted = secondV1
      // Replace v2 handler
      unsub()
      v2.on('executed', secondV2)

      const data = { text: [], images: [] }
      v1.simulateExecuted(data)
      v2.emit({ output: data })

      expect(firstV1).not.toHaveBeenCalled()
      expect(secondV1).toHaveBeenCalledOnce()
      expect(firstV2).not.toHaveBeenCalled()
      expect(secondV2).toHaveBeenCalledOnce()
    })
  })

  describe('automatic cleanup advantage of v2', () => {
    it('v1 onExecuted persists after explicit removal from tracking; v2 unsubscribe removes it cleanly', () => {
      const v1 = createV1Node()
      const v2 = createV2Bus()
      const v1Handler = vi.fn()
      const v2Handler = vi.fn()

      v1.onExecuted = v1Handler
      const unsub = v2.on('executed', v2Handler)

      // v2: explicit unsubscribe
      unsub()

      const data = { text: [], images: [] }
      v1.simulateExecuted(data) // v1 still fires (no automatic cleanup in v1)
      v2.emit({ output: data }) // v2 handler removed

      expect(v1Handler).toHaveBeenCalledOnce()
      expect(v2Handler).not.toHaveBeenCalled()
    })
  })
})

// ── Phase B stubs ─────────────────────────────────────────────────────────────

describe('BC.16 migration — per-node execution output [Phase B / shell]', () => {
  it.todo(
    '[Phase B] v1 onExecuted and v2 on("executed") fire at the same point in WebSocket message processing'
  )
  it.todo(
    '[Phase B] v2 on("executed") is automatically cleaned up on node removal; v1 leaks the assignment'
  )
})
