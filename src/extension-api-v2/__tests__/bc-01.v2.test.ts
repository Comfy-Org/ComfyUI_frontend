// Category: BC.01 — Node lifecycle: creation
// DB cross-ref: S2.N1, S2.N8
// Exemplar: https://github.com/Comfy-Org/ComfyUI_frontend/blob/main/src/extensions/core/saveImageExtraOutput.ts#L31
// compat-floor: blast_radius 4.48 ≥ 2.0 — MUST pass before v2 ships
// v2 replacement: defineNodeExtension({ nodeCreated(handle) { ... } })
// Note: v2 nodeCreated receives a NodeHandle, not a raw LGraphNode. VueNode mount
//       timing guarantee is unchanged — defer to onNodeMounted for Vue-backed state.
//
// Phase A strategy: test the API *shape* and *contract* using a local stub that
// mirrors the real service. The real mountExtensionsForNode depends on @/world/* (ECS)
// which lands in Phase B. Phase B tests are marked it.todo(Phase B).

import { describe, expect, it } from 'vitest'
import type { NodeExtensionOptions } from '@/extension-api/lifecycle'
import type { NodeHandle } from '@/extension-api/node'
import type { NodeEntityId } from '@/world/entityIds'

// ── Local stub: minimal defineNodeExtension + mount machinery ─────────────────
// Mirrors the real service contract without the ECS world dependency.
// When Phase B lands, these tests are replaced/supplemented by ones that import
// the real mountExtensionsForNode with the mocked world (see scope-registry.test.ts).

interface NodeRecord {
  entityId: NodeEntityId
  comfyClass: string
}

function createTestRuntime() {
  const extensions: NodeExtensionOptions[] = []
  const nodes = new Map<NodeEntityId, NodeRecord>()
  let nextId = 1

  function makeNodeId(): NodeEntityId {
    return `node:graph-test:${nextId++}` as NodeEntityId
  }

  function addNode(comfyClass: string): NodeEntityId {
    const id = makeNodeId()
    nodes.set(id, { entityId: id, comfyClass })
    return id
  }

  function createHandle(record: NodeRecord): NodeHandle {
    // Minimal NodeHandle stub with just the fields BC.01 tests need.
    return {
      entityId: record.entityId,
      get type() { return record.comfyClass },
      get comfyClass() { return record.comfyClass },
      // Remaining NodeHandle fields not needed for BC.01 — stub as no-ops.
      getPosition: () => [0, 0],
      getSize: () => [0, 0],
      getTitle: () => record.comfyClass,
      setTitle: () => {},
      getMode: () => 0,
      setMode: () => {},
      getProperty: () => undefined,
      getProperties: () => ({}),
      setProperty: () => {},
      widget: () => undefined,
      widgets: () => [],
      addWidget: () => { throw new Error('not implemented in stub') },
      inputs: () => [],
      outputs: () => [],
      on: () => () => {},
    } as unknown as NodeHandle
  }

  function register(options: NodeExtensionOptions) {
    extensions.push(options)
  }

  function mountNode(id: NodeEntityId, isLoaded = false): void {
    const record = nodes.get(id)
    if (!record) return

    const sorted = [...extensions].sort((a, b) => a.name.localeCompare(b.name))
    for (const ext of sorted) {
      if (ext.nodeTypes && !ext.nodeTypes.includes(record.comfyClass)) continue
      const hook = isLoaded ? ext.loadedGraphNode : ext.nodeCreated
      if (!hook) continue
      hook(createHandle(record))
    }
  }

  function clear() {
    extensions.length = 0
    nodes.clear()
    nextId = 1
  }

  return { register, addNode, mountNode, clear }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BC.01 v2 contract — node lifecycle: creation', () => {
  describe('NodeExtensionOptions shape — defineNodeExtension API', () => {
    it('NodeExtensionOptions accepts a nodeCreated callback with NodeHandle parameter', () => {
      // Type-level proof: this compiles = the contract is correctly shaped.
      const options: NodeExtensionOptions = {
        name: 'bc01.shape',
        nodeCreated(_node: NodeHandle) {
          // callback receives NodeHandle
        }
      }
      expect(options.name).toBe('bc01.shape')
      expect(typeof options.nodeCreated).toBe('function')
    })

    it('NodeExtensionOptions accepts nodeTypes filter array', () => {
      const options: NodeExtensionOptions = {
        name: 'bc01.types',
        nodeTypes: ['KSampler', 'KSamplerAdvanced'],
        nodeCreated(_node) {}
      }
      expect(options.nodeTypes).toEqual(['KSampler', 'KSamplerAdvanced'])
    })

    it('nodeTypes is optional — omitting it means global registration', () => {
      const options: NodeExtensionOptions = {
        name: 'bc01.global',
        nodeCreated(_node) {}
      }
      expect(options.nodeTypes).toBeUndefined()
    })
  })

  describe('nodeCreated(handle) — per-instance setup', () => {
    it('nodeCreated is called once per node instance', () => {
      const rt = createTestRuntime()
      const calls: NodeHandle[] = []

      rt.register({ name: 'bc01.creation-once', nodeCreated(h) { calls.push(h) } })
      const id = rt.addNode('TestNode')
      rt.mountNode(id)

      expect(calls).toHaveLength(1)
    })

    it('NodeHandle.entityId matches the node being created', () => {
      const rt = createTestRuntime()
      let capturedId: NodeEntityId | undefined

      rt.register({ name: 'bc01.entity-id', nodeCreated(h) { capturedId = h.entityId as NodeEntityId } })
      const id = rt.addNode('TestNode')
      rt.mountNode(id)

      expect(capturedId).toBe(id)
    })

    it('NodeHandle.type returns the comfyClass of the node', () => {
      const rt = createTestRuntime()
      let capturedType: string | undefined

      rt.register({ name: 'bc01.type-read', nodeCreated(h) { capturedType = h.type } })
      const id = rt.addNode('KSampler')
      rt.mountNode(id)

      expect(capturedType).toBe('KSampler')
    })

    it('nodeCreated fires separately for each node instance — independent calls', () => {
      const rt = createTestRuntime()
      let callCount = 0

      rt.register({ name: 'bc01.multi-instance', nodeCreated() { callCount++ } })
      rt.mountNode(rt.addNode('TestNode'))
      rt.mountNode(rt.addNode('TestNode'))

      expect(callCount).toBe(2)
    })
  })

  describe('type-level registration — nodeTypes filter (replacement for S2.N8)', () => {
    it('nodeTypes filter: nodeCreated fires only for matching comfyClass', () => {
      const rt = createTestRuntime()
      const received: string[] = []

      rt.register({
        name: 'bc01.type-scoped',
        nodeTypes: ['KSampler'],
        nodeCreated(h) { received.push(h.type) }
      })

      rt.mountNode(rt.addNode('KSampler'))
      rt.mountNode(rt.addNode('CLIPTextEncode'))

      expect(received).toEqual(['KSampler'])
    })

    it('omitting nodeTypes fires nodeCreated for every node type', () => {
      const rt = createTestRuntime()
      const received: string[] = []

      rt.register({ name: 'bc01.global', nodeCreated(h) { received.push(h.type) } })

      rt.mountNode(rt.addNode('KSampler'))
      rt.mountNode(rt.addNode('CLIPTextEncode'))

      expect(received).toEqual(['KSampler', 'CLIPTextEncode'])
    })

    it('type-scoped registration does not fire for unregistered node types', () => {
      const rt = createTestRuntime()
      let fired = false

      rt.register({
        name: 'bc01.no-fire',
        nodeTypes: ['KSampler'],
        nodeCreated() { fired = true }
      })

      rt.mountNode(rt.addNode('Note'))

      expect(fired).toBe(false)
    })
  })

  describe('extension firing order — D10b lexicographic', () => {
    it('multiple extensions fire in lexicographic order by name for the same node', () => {
      const rt = createTestRuntime()
      const order: string[] = []

      rt.register({ name: 'bc01.z-ext', nodeCreated() { order.push('z-ext') } })
      rt.register({ name: 'bc01.a-ext', nodeCreated() { order.push('a-ext') } })
      rt.register({ name: 'bc01.m-ext', nodeCreated() { order.push('m-ext') } })

      rt.mountNode(rt.addNode('TestNode'))

      expect(order).toEqual(['a-ext', 'm-ext', 'z-ext'])
    })
  })

  describe('D12 reset-to-fresh on copy/paste', () => {
    it('each mountNode call (new entityId) runs fresh nodeCreated — no shared state', () => {
      const rt = createTestRuntime()
      let setupCount = 0

      rt.register({ name: 'bc01.fresh-copy', nodeCreated() { setupCount++ } })

      rt.mountNode(rt.addNode('TestNode')) // source
      expect(setupCount).toBe(1)

      rt.mountNode(rt.addNode('TestNode')) // paste → new entityId → new setup
      expect(setupCount).toBe(2)
    })
  })

  describe('VueNode mount timing invariant', () => {
    it.todo(
      // Phase B: requires VueNode mount simulation (BC.37 two-phase harness).
      'nodeCreated fires before VueNode mounts; onNodeMounted deferred to Vue mount phase (Phase B)'
    )
  })
})
