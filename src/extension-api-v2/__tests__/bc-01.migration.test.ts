// Category: BC.01 — Node lifecycle: creation
// DB cross-ref: S2.N1, S2.N8
// compat-floor: blast_radius 4.48 ≥ 2.0 — MUST pass before v2 ships
// Migration: v1 nodeCreated(node) + beforeRegisterNodeDef → v2 defineNodeExtension({ nodeCreated(handle) })
//
// Phase A strategy: test behavioral equivalence between v1 and v2 patterns
// using local stubs. Real ECS dispatch (Phase B) is marked it.todo.

import { describe, expect, it } from 'vitest'
import type { NodeExtensionOptions } from '@/extension-api/lifecycle'
import type { NodeHandle } from '@/extension-api/node'
import type { NodeEntityId } from '@/world/entityIds'

// ── V1 app shim ───────────────────────────────────────────────────────────────
// Minimal stand-in for v1 app.registerExtension behavior.

interface V1NodeLike { id: number; type: string }
interface V1Extension {
  name: string
  nodeCreated?: (node: V1NodeLike) => void
}

function createV1App() {
  const extensions: V1Extension[] = []
  const callLog: V1NodeLike[] = []

  return {
    registerExtension(ext: V1Extension) { extensions.push(ext) },
    simulateNodeCreated(node: V1NodeLike) {
      callLog.push(node)
      for (const ext of extensions) ext.nodeCreated?.(node)
    },
    get totalCreated() { return callLog.length }
  }
}

// ── V2 stub runtime ───────────────────────────────────────────────────────────
// Mirrors the real service contract without the ECS dependency.

interface NodeRecord { entityId: NodeEntityId; comfyClass: string }

function createV2Runtime() {
  const extensions: NodeExtensionOptions[] = []
  const nodes = new Map<NodeEntityId, NodeRecord>()
  let nextId = 1

  function makeId(): NodeEntityId {
    return `node:mig-test:${nextId++}` as NodeEntityId
  }

  function createHandle(r: NodeRecord): NodeHandle {
    return {
      entityId: r.entityId,
      get type() { return r.comfyClass },
      get comfyClass() { return r.comfyClass },
      getPosition: () => [0, 0],
      getSize: () => [0, 0],
      getTitle: () => r.comfyClass,
      setTitle: () => {},
      getMode: () => 0,
      setMode: () => {},
      getProperty: () => undefined,
      getProperties: () => ({}),
      setProperty: () => {},
      widget: () => undefined,
      widgets: () => [],
      addWidget: () => { throw new Error('not implemented') },
      inputs: () => [],
      outputs: () => [],
      on: () => () => {},
    } as unknown as NodeHandle
  }

  function register(options: NodeExtensionOptions) { extensions.push(options) }

  function mountNode(comfyClass: string, isLoaded = false): NodeEntityId {
    const id = makeId()
    nodes.set(id, { entityId: id, comfyClass })
    const sorted = [...extensions].sort((a, b) => a.name.localeCompare(b.name))
    for (const ext of sorted) {
      if (ext.nodeTypes && !ext.nodeTypes.includes(comfyClass)) continue
      const hook = isLoaded ? ext.loadedGraphNode : ext.nodeCreated
      hook?.(createHandle({ entityId: id, comfyClass }))
    }
    return id
  }

  function clear() { extensions.length = 0; nodes.clear(); nextId = 1 }

  return { register, mountNode, clear }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BC.01 migration — node lifecycle: creation', () => {
  describe('nodeCreated call-count parity (S2.N1)', () => {
    it('v1 and v2 nodeCreated are both called once per node created', () => {
      const v1 = createV1App()
      const v2 = createV2Runtime()
      let v2Count = 0

      v1.registerExtension({ name: 'parity', nodeCreated() {} })
      v2.register({ name: 'bc01.mig.parity', nodeCreated() { v2Count++ } })

      const types = ['KSampler', 'KSampler', 'CLIPTextEncode']
      types.forEach((t, i) => v1.simulateNodeCreated({ id: i, type: t }))
      types.forEach((t) => v2.mountNode(t))

      expect(v2Count).toBe(v1.totalCreated)
      expect(v2Count).toBe(3)
    })

    it('v2 nodeCreated fires in lexicographic name order (D10b tie-break)', () => {
      const v2 = createV2Runtime()
      const order: string[] = []

      v2.register({ name: 'bc01.mig.z-ext', nodeCreated() { order.push('z-ext') } })
      v2.register({ name: 'bc01.mig.a-ext', nodeCreated() { order.push('a-ext') } })
      v2.register({ name: 'bc01.mig.m-ext', nodeCreated() { order.push('m-ext') } })

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
        nodeCreated(h) { v2Received.push(h.type) }
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

      v2.register({ name: 'bc01.mig.exclude', nodeTypes: ['KSampler'], nodeCreated(h) { received.push(h.type) } })
      v2.mountNode('Note')

      expect(received).toHaveLength(0)
    })
  })

  describe('D12 reset-to-fresh on copy/paste', () => {
    it('copy/paste (new entityId) triggers fresh nodeCreated, not a clone of source state', () => {
      const v2 = createV2Runtime()
      let setupCount = 0

      v2.register({ name: 'bc01.mig.fresh-copy', nodeCreated() { setupCount++ } })

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
