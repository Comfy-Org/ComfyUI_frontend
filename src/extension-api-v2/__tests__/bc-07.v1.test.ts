// Category: BC.07 — Connection observation, intercept, and veto
// DB cross-ref: S2.N3, S2.N12, S2.N13
// Exemplar: https://github.com/rgthree/rgthree-comfy/blob/main/web/comfyui/node_mode_relay.js#L90
// blast_radius: 5.46 — compat-floor: blast_radius ≥ 2.0 — MUST pass before v2 ships
// v1 contract: node.onConnectInput(slot, type, link, node, fromSlot)
//              node.onConnectOutput(slot, type, link, node, toSlot)
//              node.onConnectionsChange(type, slot, connected, link, ioSlot)

import { describe, expect, it } from 'vitest'
import {
  countEvidenceExcerpts,
  createMiniComfyApp,
  loadEvidenceSnippet,
  runV1
} from '../harness'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BC.07 v1 contract — connection observation, intercept, and veto', () => {
  describe('S2.N3 — onConnectionsChange: passive observation (synthetic)', () => {
    it('callback fires when called with (type, slot, connected, link, ioSlot)', () => {
      const received: unknown[][] = []
      const node = {
        onConnectionsChange(
          type: number,
          slot: number,
          connected: boolean,
          link: unknown,
          ioSlot: unknown
        ) {
          received.push([type, slot, connected, link, ioSlot])
        }
      }
      const fakeLink = { id: 1, origin_id: 10, target_id: 20 }
      const fakeIoSlot = { name: 'value', type: 'FLOAT' }

      node.onConnectionsChange(1, 0, true, fakeLink, fakeIoSlot)

      expect(received).toHaveLength(1)
      expect(received[0]).toEqual([1, 0, true, fakeLink, fakeIoSlot])
    })

    it('fires for both source and target (simulate calling on each node in a pair)', () => {
      const fired: string[] = []

      const sourceNode = {
        onConnectionsChange(_type: number, _slot: number, _connected: boolean, _link: unknown, _ioSlot: unknown) {
          fired.push('source')
        }
      }
      const targetNode = {
        onConnectionsChange(_type: number, _slot: number, _connected: boolean, _link: unknown, _ioSlot: unknown) {
          fired.push('target')
        }
      }

      const fakeLink = { id: 2 }
      sourceNode.onConnectionsChange(2, 0, true, fakeLink, undefined)
      targetNode.onConnectionsChange(1, 0, true, fakeLink, undefined)

      expect(fired).toEqual(['source', 'target'])
    })

    it.todo(
      'real LiteGraph graph wiring'
    )
    it.todo(
      'link object from LiteGraph'
    )
  })

  describe('S2.N12 — onConnectInput: intercept and veto incoming connections (synthetic)', () => {
    it('returning false from onConnectInput vetoes the connection', () => {
      const node = {
        onConnectInput(
          _slot: number,
          _type: string,
          _link: unknown,
          _sourceNode: unknown,
          _sourceSlot: number
        ): boolean {
          return false
        }
      }

      const result = node.onConnectInput(0, 'FLOAT', {}, {}, 0)
      const vetoed = result === false

      expect(vetoed).toBe(true)
    })

    it('returning true allows connection', () => {
      const node = {
        onConnectInput(
          _slot: number,
          _type: string,
          _link: unknown,
          _sourceNode: unknown,
          _sourceSlot: number
        ): boolean {
          return true
        }
      }

      const result = node.onConnectInput(0, 'FLOAT', {}, {}, 0)

      expect(result).toBe(true)
    })

    it('receives (slot, type, link, sourceNode, sourceSlot) args', () => {
      const received: unknown[] = []
      const node = {
        onConnectInput(
          slot: number,
          type: string,
          link: unknown,
          sourceNode: unknown,
          sourceSlot: number
        ): boolean {
          received.push(slot, type, link, sourceNode, sourceSlot)
          return true
        }
      }
      const fakeLink = { id: 3 }
      const fakeSource = { id: 99 }

      node.onConnectInput(2, 'IMAGE', fakeLink, fakeSource, 1)

      expect(received).toEqual([2, 'IMAGE', fakeLink, fakeSource, 1])
    })

    it.todo(
      'real LiteGraph graph wiring'
    )
  })

  describe('S2.N13 — onConnectOutput: intercept and veto outgoing connections (synthetic)', () => {
    it('returning false vetoes outgoing connection', () => {
      const node = {
        onConnectOutput(
          _slot: number,
          _type: string,
          _link: unknown,
          _targetNode: unknown,
          _targetSlot: number
        ): boolean {
          return false
        }
      }

      const result = node.onConnectOutput(0, 'LATENT', {}, {}, 0)

      expect(result).toBe(false)
    })

    it('veto means onConnectionsChange does NOT fire', () => {
      let changesFired = false

      const outputNode = {
        onConnectOutput(
          _slot: number,
          _type: string,
          _link: unknown,
          _targetNode: unknown,
          _targetSlot: number
        ): boolean {
          return false
        },
        onConnectionsChange(_type: number, _slot: number, _connected: boolean, _link: unknown, _ioSlot: unknown) {
          changesFired = true
        }
      }

      const vetoed = outputNode.onConnectOutput(0, 'LATENT', {}, {}, 0) === false
      if (!vetoed) {
        outputNode.onConnectionsChange(2, 0, true, {}, undefined)
      }

      expect(changesFired).toBe(false)
    })

    it('returning false vetoes outgoing connection — same pattern as onConnectInput', () => {
      const results: boolean[] = []

      const nodeAllow = {
        onConnectOutput(): boolean { return true }
      }
      const nodeVeto = {
        onConnectOutput(): boolean { return false }
      }

      results.push(nodeAllow.onConnectOutput())
      results.push(nodeVeto.onConnectOutput())

      expect(results).toEqual([true, false])
    })

    it.todo(
      'real LiteGraph graph wiring'
    )
    it.todo(
      'link object from LiteGraph'
    )
  })

  describe('S2.N3 — evidence excerpts', () => {
    it('S2.N3 has at least one evidence excerpt', () => {
      expect(countEvidenceExcerpts('S2.N3')).toBeGreaterThan(0)
    })

    it('S2.N3 evidence snippet contains onConnectionsChange fingerprint', () => {
      const snippet = loadEvidenceSnippet('S2.N3', 0)
      expect(snippet).toMatch(/onConnectionsChange/i)
    })

    it('S2.N3 snippet is capturable by runV1 without throwing', () => {
      const snippet = loadEvidenceSnippet('S2.N3', 0)
      const app = createMiniComfyApp()
      expect(() => runV1(snippet, { app })).not.toThrow()
    })
  })

  describe('S2.N12 — evidence excerpts', () => {
    it('S2.N12 has at least one evidence excerpt', () => {
      expect(countEvidenceExcerpts('S2.N12')).toBeGreaterThan(0)
    })

    it('S2.N12 evidence snippet contains onConnectInput fingerprint', () => {
      const snippet = loadEvidenceSnippet('S2.N12', 0)
      expect(snippet).toMatch(/onConnectInput/i)
    })

    it('S2.N12 snippet is capturable by runV1 without throwing', () => {
      const snippet = loadEvidenceSnippet('S2.N12', 0)
      const app = createMiniComfyApp()
      expect(() => runV1(snippet, { app })).not.toThrow()
    })
  })

  describe('S2.N13 — evidence excerpts', () => {
    it('S2.N13 has at least one evidence excerpt', () => {
      expect(countEvidenceExcerpts('S2.N13')).toBeGreaterThan(0)
    })

    it('S2.N13 evidence snippet contains onConnectOutput fingerprint', () => {
      const snippet = loadEvidenceSnippet('S2.N13', 0)
      expect(snippet).toMatch(/onConnectOutput/i)
    })

    it('S2.N13 snippet is capturable by runV1 without throwing', () => {
      const snippet = loadEvidenceSnippet('S2.N13', 0)
      const app = createMiniComfyApp()
      expect(() => runV1(snippet, { app })).not.toThrow()
    })
  })
})
