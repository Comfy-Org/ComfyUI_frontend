// Category: BC.20 — Custom node-type registration (frontend-only / virtual)
// DB cross-ref: S1.H5, S1.H6, S8.P1
// Exemplar: https://github.com/Comfy-Org/ComfyUI_frontend/blob/main/src/extensions/core/rerouteNode.ts
// blast_radius: 5.49 (compat-floor)
// compat-floor: blast_radius ≥ 2.0
// v1 contract: LiteGraph.registerNodeType('MyType', MyClass)
//              MyClass.prototype.isVirtualNode = true
//              registerExtension({ beforeRegisterNodeDef(nodeType, nodeData) { ... } })

import { describe, expect, it, vi } from 'vitest'

// ── Minimal LiteGraph.registerNodeType shim ───────────────────────────────────

interface NodeConstructor {
  new (): { type?: string }
  prototype: { isVirtualNode?: boolean; type?: string }
}

function createMockLiteGraph() {
  const registry = new Map<string, NodeConstructor>()

  return {
    registerNodeType(typeName: string, NodeClass: NodeConstructor) {
      NodeClass.prototype.type = typeName
      registry.set(typeName, NodeClass)
    },
    createNode(typeName: string) {
      const Cls = registry.get(typeName)
      return Cls ? new Cls() : undefined
    },
    has(typeName: string) {
      return registry.has(typeName)
    },
    get(typeName: string) {
      return registry.get(typeName)
    }
  }
}

// ── Minimal extension registration shim ──────────────────────────────────────

interface NodeDef { name: string; inputs: Record<string, unknown> }
interface NodeTypeStub { prototype: Record<string, unknown>; name: string }

function createMockApp(LiteGraph: ReturnType<typeof createMockLiteGraph>) {
  const extensions: { beforeRegisterNodeDef?: (nt: NodeTypeStub, nd: NodeDef) => void; registerCustomNodes?: (app: unknown) => void }[] = []

  return {
    registerExtension(ext: (typeof extensions)[0]) {
      extensions.push(ext)
    },
    simulateBeforeRegisterNodeDef(nodeType: NodeTypeStub, nodeData: NodeDef) {
      for (const ext of extensions) {
        ext.beforeRegisterNodeDef?.(nodeType, nodeData)
      }
    },
    simulateSetup() {
      for (const ext of extensions) {
        ext.registerCustomNodes?.(this)
      }
    },
    LiteGraph
  }
}

// ── Minimal prompt serializer ─────────────────────────────────────────────────
// v1 graphToPrompt excludes virtual nodes from backend payload.

function serializeGraph(nodes: Array<{ id: number; type: string; constructor: NodeConstructor }>) {
  const output: Record<number, { class_type: string }> = {}
  for (const node of nodes) {
    if (!node.constructor.prototype.isVirtualNode) {
      output[node.id] = { class_type: node.type }
    }
  }
  return output
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BC.20 v1 contract — LiteGraph.registerNodeType and isVirtualNode', () => {
  describe('S1.H5 — registerCustomNodes hook (synthetic)', () => {
    it('registerExtension({ registerCustomNodes(app) }) is called during setup', () => {
      const LiteGraph = createMockLiteGraph()
      const app = createMockApp(LiteGraph)
      const setupFn = vi.fn()

      app.registerExtension({ registerCustomNodes: setupFn })
      app.simulateSetup()

      expect(setupFn).toHaveBeenCalledOnce()
    })

    it('LiteGraph.registerNodeType inside registerCustomNodes makes the type instantiable', () => {
      const LiteGraph = createMockLiteGraph()
      const app = createMockApp(LiteGraph)

      class MyRerouteNode { }
      app.registerExtension({
        registerCustomNodes() {
          LiteGraph.registerNodeType('MyReroute', MyRerouteNode as unknown as NodeConstructor)
        }
      })
      app.simulateSetup()

      expect(LiteGraph.has('MyReroute')).toBe(true)
      const instance = LiteGraph.createNode('MyReroute')
      expect(instance).toBeDefined()
    })

    it('setting MyClass.prototype.isVirtualNode = true marks the type as virtual', () => {
      const LiteGraph = createMockLiteGraph()
      const app = createMockApp(LiteGraph)

      class VirtualNode { }
      VirtualNode.prototype.isVirtualNode = true

      app.registerExtension({
        registerCustomNodes() {
          LiteGraph.registerNodeType('VirtualReroute', VirtualNode as unknown as NodeConstructor)
        }
      })
      app.simulateSetup()

      const Cls = LiteGraph.get('VirtualReroute')
      expect(Cls?.prototype.isVirtualNode).toBe(true)
    })
  })

  describe('S1.H6 — beforeRegisterNodeDef hook (synthetic)', () => {
    it('beforeRegisterNodeDef fires for each node type being registered', () => {
      const LiteGraph = createMockLiteGraph()
      const app = createMockApp(LiteGraph)
      const seenTypes: string[] = []

      app.registerExtension({
        beforeRegisterNodeDef(nodeType) {
          seenTypes.push(nodeType.name)
        }
      })

      app.simulateBeforeRegisterNodeDef({ prototype: {}, name: 'KSampler' }, { name: 'KSampler', inputs: {} })
      app.simulateBeforeRegisterNodeDef({ prototype: {}, name: 'CLIPTextEncode' }, { name: 'CLIPTextEncode', inputs: {} })

      expect(seenTypes).toEqual(['KSampler', 'CLIPTextEncode'])
    })

    it('extension can augment nodeType prototype inside beforeRegisterNodeDef', () => {
      const LiteGraph = createMockLiteGraph()
      const app = createMockApp(LiteGraph)

      const nodeType: NodeTypeStub = { prototype: {}, name: 'KSampler' }

      app.registerExtension({
        beforeRegisterNodeDef(nt) {
          nt.prototype['myExtensionData'] = 'injected'
        }
      })

      app.simulateBeforeRegisterNodeDef(nodeType, { name: 'KSampler', inputs: {} })

      expect(nodeType.prototype['myExtensionData']).toBe('injected')
    })

    it('multiple extensions firing beforeRegisterNodeDef each see the same nodeType', () => {
      const LiteGraph = createMockLiteGraph()
      const app = createMockApp(LiteGraph)
      const results: string[] = []

      app.registerExtension({ beforeRegisterNodeDef(nt) { nt.prototype['extA'] = true; results.push('A') } })
      app.registerExtension({ beforeRegisterNodeDef(nt) { nt.prototype['extB'] = true; results.push('B') } })

      const nt: NodeTypeStub = { prototype: {}, name: 'VAEDecode' }
      app.simulateBeforeRegisterNodeDef(nt, { name: 'VAEDecode', inputs: {} })

      expect(results).toEqual(['A', 'B'])
      expect(nt.prototype['extA']).toBe(true)
      expect(nt.prototype['extB']).toBe(true)
    })
  })

  describe('S8.P1 — virtual node payload suppression (synthetic)', () => {
    it('serializeGraph excludes nodes with isVirtualNode === true from the output', () => {
      class RealNode { }
      class VirtualNode { }
      VirtualNode.prototype.isVirtualNode = true

      const nodes = [
        { id: 1, type: 'KSampler', constructor: RealNode as unknown as NodeConstructor },
        { id: 2, type: 'VirtualReroute', constructor: VirtualNode as unknown as NodeConstructor },
        { id: 3, type: 'CLIPTextEncode', constructor: RealNode as unknown as NodeConstructor }
      ]

      const output = serializeGraph(nodes)

      expect(Object.keys(output)).toHaveLength(2)
      expect(output[1]).toBeDefined()
      expect(output[3]).toBeDefined()
      expect(output[2]).toBeUndefined() // virtual node excluded
    })

    it('non-virtual nodes are all included in the serialized output', () => {
      class RealNode { }
      const nodes = [
        { id: 10, type: 'KSampler', constructor: RealNode as unknown as NodeConstructor },
        { id: 11, type: 'VAEDecode', constructor: RealNode as unknown as NodeConstructor }
      ]

      const output = serializeGraph(nodes)
      expect(Object.keys(output)).toHaveLength(2)
    })
  })

  describe('Phase B deferred', () => {
    it.todo(
      'virtual node is still visible and interactive in the LiteGraph canvas — requires real LiteGraph canvas (Phase B)'
    )
    it.todo(
      'links connected to a virtual node are re-routed in the serialized output to preserve logical connectivity (Phase B + UWF Phase 3)'
    )
  })
})
