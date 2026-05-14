// Category: BC.01 — Node lifecycle: creation
// DB cross-ref: S2.N1, S2.N8
// compat-floor: blast_radius 4.48 ≥ 2.0 — MUST pass before v2 ships
// Migration: v1 nodeCreated(node) + beforeRegisterNodeDef → v2 defineNode({ nodeCreated(handle) })
//
// Phase A strategy: test behavioral equivalence between v1 and v2 patterns
// using local stubs. Real ECS dispatch (Phase B) is marked it.todo.

import { describe, expect, it } from 'vitest'

// ── Shared harness ────────────────────────────────────────────────────────────
// Pilot migration off inline createV1App / createV2Runtime blocks.
// See `harness/README.md` for the broader rollout plan.
import { createV1App } from './harness/v1App'
import { createV2Runtime as createSharedV2Runtime } from './harness/v2Runtime'

const createV2Runtime = () => {
  const rt = createSharedV2Runtime({ idPrefix: 'mig-test' })
  // Migration tests historically called `mountNode(comfyClass)` directly.
  // Bridge to the shared runtime's `addNode` + `mountNode(id)` shape so
  // the rest of the file is left untouched.
  return {
    register: rt.register,
    mountNode: (comfyClass: string, isLoaded = false) => {
      const id = rt.addNode(comfyClass)
      rt.mountNode(id, isLoaded)
      return id
    },
    clear: rt.clear
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BC.01 migration — node lifecycle: creation', () => {
  describe('nodeCreated call-count parity (S2.N1)', () => {
    it('v1 and v2 nodeCreated are both called once per node created', () => {
      const v1 = createV1App()
      const v2 = createV2Runtime()
      let v2Count = 0

      v1.registerExtension({ name: 'parity', nodeCreated() {} })
      v2.register({
        name: 'bc01.mig.parity',
        nodeCreated() {
          v2Count++
        }
      })

      const types = ['KSampler', 'KSampler', 'CLIPTextEncode']
      types.forEach((t, i) => v1.simulateNodeCreated({ id: i, type: t }))
      types.forEach((t) => v2.mountNode(t))

      expect(v2Count).toBe(v1.totalCreated)
      expect(v2Count).toBe(3)
    })

    it('v2 nodeCreated fires in lexicographic name order (D10b tie-break)', () => {
      const v2 = createV2Runtime()
      const order: string[] = []

      v2.register({
        name: 'bc01.mig.z-ext',
        nodeCreated() {
          order.push('z-ext')
        }
      })
      v2.register({
        name: 'bc01.mig.a-ext',
        nodeCreated() {
          order.push('a-ext')
        }
      })
      v2.register({
        name: 'bc01.mig.m-ext',
        nodeCreated() {
          order.push('m-ext')
        }
      })

      v2.mountNode('TestNode')

      expect(order).toEqual(['a-ext', 'm-ext', 'z-ext'])
    })
  })

  describe('beforeRegisterNodeDef type-guard → nodeTypes filter (S2.N8)', () => {
    it('v2 nodeTypes filter produces identical per-type call counts as v1 type-guard pattern', () => {
      const v1 = createV1App()
      const v2 = createV2Runtime()
      const v1Received: string[] = []
      const v2Received: string[] = []

      // v1: explicit type-guard inside callback
      v1.registerExtension({
        name: 'type-guard',
        nodeCreated(node) {
          if (node.type === 'KSampler') v1Received.push(node.type)
        }
      })

      // v2: declarative filter
      v2.register({
        name: 'bc01.mig.type-filter',
        nodeTypes: ['KSampler'],
        nodeCreated(h) {
          v2Received.push(h.type)
        }
      })

      const types = ['KSampler', 'CLIPTextEncode', 'KSampler']
      types.forEach((t, i) => v1.simulateNodeCreated({ id: i, type: t }))
      types.forEach((t) => v2.mountNode(t))

      expect(v2Received).toEqual(v1Received)
      expect(v2Received).toEqual(['KSampler', 'KSampler'])
    })

    it('excluded types receive no v2 nodeCreated call, matching v1 type-guard exclusion', () => {
      const v2 = createV2Runtime()
      const received: string[] = []

      v2.register({
        name: 'bc01.mig.exclude',
        nodeTypes: ['KSampler'],
        nodeCreated(h) {
          received.push(h.type)
        }
      })
      v2.mountNode('Note')

      expect(received).toHaveLength(0)
    })
  })

  describe('D12 reset-to-fresh on copy/paste', () => {
    it('copy/paste (new entityId) triggers fresh nodeCreated, not a clone of source state', () => {
      const v2 = createV2Runtime()
      let setupCount = 0

      v2.register({
        name: 'bc01.mig.fresh-copy',
        nodeCreated() {
          setupCount++
        }
      })

      v2.mountNode('TestNode') // source
      expect(setupCount).toBe(1)

      v2.mountNode('TestNode') // paste → new entityId → fresh setup
      expect(setupCount).toBe(2)
    })
  })

  describe('VueNode mount timing invariant', () => {
    it.todo(
      // Phase B: requires two-phase harness simulation (BC.37).
      'both v1 and v2 nodeCreated fire before VueNode mounts — runtime proof deferred to Phase B'
    )
  })
})
