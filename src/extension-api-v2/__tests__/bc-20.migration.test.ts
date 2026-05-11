// Category: BC.20 — Custom node-type registration (frontend-only / virtual)
// DB cross-ref: S1.H5, S1.H6, S8.P1
// blast_radius: 5.49 — compat-floor: MUST pass before v2 ships
// Migration: v1 LiteGraph.registerNodeType + isVirtualNode → v2 NodeExtensionOptions + nodeTypes filter
//            v1 beforeRegisterNodeDef prototype augmentation → v2 nodeCreated(handle)
//
// Phase A: type-shape and registration contract equivalence using synthetic stubs.
// Virtual exclusion (S8.P1) and resolveConnections are Phase B — marked todo.
//
// I-TF.8 — BC.20 migration wired assertions.

import { describe, expect, it, vi } from 'vitest'
import type { NodeExtensionOptions } from '@/extension-api/lifecycle'

// ── V1 app shim ───────────────────────────────────────────────────────────────

interface V1LGraphNode { type: string; id: number }
interface V1Extension {
  name: string
  beforeRegisterNodeDef?: (nodeType: { comfyClass: string }, nodeDef: { name: string }) => void
  nodeCreated?: (node: V1LGraphNode) => void
}

function createV1App() {
  const extensions: V1Extension[] = []
  const registeredTypes: string[] = []

  return {
    registerExtension(ext: V1Extension) { extensions.push(ext) },
    /** Simulate beforeRegisterNodeDef firing for a batch of node defs */
    simulateRegisterNodeDef(nodeType: { comfyClass: string }, nodeDef: { name: string }) {
      for (const ext of extensions) {
        ext.beforeRegisterNodeDef?.(nodeType, nodeDef)
      }
    },
    simulateNodeCreated(node: V1LGraphNode) {
      for (const ext of extensions) ext.nodeCreated?.(node)
    },
    registerNodeType(type: string) { registeredTypes.push(type) },
    get registeredTypes() { return [...registeredTypes] }
  }
}

// ── V2 runtime shim ───────────────────────────────────────────────────────────

function createV2Runtime() {
  const extensions: NodeExtensionOptions[] = []
  let nextId = 1

  function register(opts: NodeExtensionOptions) {
    extensions.push(opts)
  }

  function mountNode(comfyClass: string, isLoaded = false) {
    const id = nextId++
    const handle = { type: comfyClass, comfyClass, entityId: `node:test:${id}` } as Parameters<NonNullable<NodeExtensionOptions['nodeCreated']>>[0]
    const sorted = [...extensions].sort((a, b) => a.name.localeCompare(b.name))
    for (const ext of sorted) {
      if (ext.nodeTypes && !ext.nodeTypes.includes(comfyClass)) continue
      const hook = isLoaded ? ext.loadedGraphNode : ext.nodeCreated
      hook?.(handle)
    }
    return id
  }

  return { register, mountNode }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BC.20 migration — custom and virtual node registration', () => {
  describe('beforeRegisterNodeDef type-guard → nodeTypes filter (S1.H5, S1.H6)', () => {
    it('v1 beforeRegisterNodeDef type-guard and v2 nodeTypes filter produce identical per-type call counts', () => {
      const v1 = createV1App()
      const v2 = createV2Runtime()
      const v1Received: string[] = []
      const v2Received: string[] = []

      // v1: explicit guard inside beforeRegisterNodeDef
      v1.registerExtension({
        name: 'bc20.mig.v1-guard',
        beforeRegisterNodeDef(nodeType) {
          if (nodeType.comfyClass === 'RerouteNode') {
            v1Received.push(nodeType.comfyClass)
          }
        }
      })

      // v2: declarative filter
      v2.register({
        name: 'bc20.mig.v2-filter',
        nodeTypes: ['RerouteNode'],
        nodeCreated(h) { v2Received.push(h.type) }
      })

      const nodeDefs = ['RerouteNode', 'KSampler', 'RerouteNode', 'CLIPTextEncode']
      for (const def of nodeDefs) {
        v1.simulateRegisterNodeDef({ comfyClass: def }, { name: def })
        v2.mountNode(def)
      }

      expect(v2Received).toEqual(v1Received)
      expect(v2Received).toEqual(['RerouteNode', 'RerouteNode'])
    })

    it('global extension (no nodeTypes) fires for every node type, matching v1 unguarded handler', () => {
      const v1 = createV1App()
      const v2 = createV2Runtime()
      const v1Count = { n: 0 }
      const v2Count = { n: 0 }

      v1.registerExtension({ name: 'bc20.mig.v1-global', nodeCreated() { v1Count.n++ } })
      v2.register({ name: 'bc20.mig.v2-global', nodeCreated() { v2Count.n++ } })

      const types = ['RerouteNode', 'KSampler', 'CLIPTextEncode']
      types.forEach((t, i) => v1.simulateNodeCreated({ type: t, id: i }))
      types.forEach((t) => v2.mountNode(t))

      expect(v2Count.n).toBe(v1Count.n)
      expect(v2Count.n).toBe(3)
    })
  })

  describe('nodeCreated as replacement for prototype augmentation (S1.H6)', () => {
    it('v2 nodeCreated fires once per instance, matching v1 nodeCreated per-instance semantics', () => {
      const v2 = createV2Runtime()
      const created = vi.fn()
      v2.register({ name: 'bc20.mig.per-instance', nodeCreated: created })

      v2.mountNode('KSampler')
      v2.mountNode('KSampler')
      v2.mountNode('CLIPTextEncode')

      expect(created).toHaveBeenCalledTimes(3)
    })

    it('nodeCreated receives the correct type for each mounted node', () => {
      const v2 = createV2Runtime()
      const types: string[] = []
      v2.register({ name: 'bc20.mig.type-check', nodeCreated(h) { types.push(h.type) } })

      v2.mountNode('KSampler')
      v2.mountNode('RerouteNode')

      expect(types).toEqual(['KSampler', 'RerouteNode'])
    })
  })

  describe('D10b lexicographic hook ordering — v2 only', () => {
    it('multiple v2 extensions fire in lexicographic name order for the same node type', () => {
      const v2 = createV2Runtime()
      const order: string[] = []

      v2.register({ name: 'bc20.mig.z', nodeCreated() { order.push('z') } })
      v2.register({ name: 'bc20.mig.a', nodeCreated() { order.push('a') } })
      v2.register({ name: 'bc20.mig.m', nodeCreated() { order.push('m') } })

      v2.mountNode('TestNode')
      expect(order).toEqual(['a', 'm', 'z'])
    })
  })

  describe('[gap] isVirtualNode / virtual:true serialization equivalence (S8.P1)', () => {
    it.todo(
      '[gap] v1 isVirtualNode=true and v2 virtual:true both exclude the node from graphToPrompt output. ' +
      'Phase B required — virtual:true field not yet on NodeExtensionOptions.'
    )
    it.todo(
      '[gap] link re-routing through virtual nodes: v1 graphToPrompt patch and v2 resolveConnections produce equivalent source→target pairs. ' +
      'Phase B required — resolveConnections not yet on NodeExtensionOptions.'
    )
    it.todo(
      '[gap] canvas rendering of a virtual node registered via v2 defineNodeExtension is identical to v1 LiteGraph.registerNodeType. ' +
      'Phase B required — canvas render system not in harness.'
    )
  })
})
