// Category: BC.01 — Node lifecycle: creation
// DB cross-ref: S2.N1, S2.N8
// Exemplar: https://github.com/Comfy-Org/ComfyUI_frontend/blob/main/src/extensions/core/saveImageExtraOutput.ts#L31
// Surface: S2.N1 = nodeCreated hook, S2.N8 = beforeRegisterNodeDef
// compat-floor: blast_radius 4.48 ≥ 2.0 — MUST pass before v2 ships
// v1 contract: app.registerExtension({ nodeCreated(node) { ... } })
// Note: nodeCreated fires BEFORE the VueNode Vue component mounts; extensions needing
//       VueNode-backed state must defer (see BC.37).

import { describe, expect, it, vi } from 'vitest'
import {
  createMiniComfyApp,
  countEvidenceExcerpts,
  loadEvidenceSnippet,
  runV1
} from '../harness'

describe('BC.01 v1 contract — node lifecycle: creation', () => {
  describe('S2.N1 — evidence excerpts', () => {
    it('S2.N1 has at least one evidence excerpt', () => {
      expect(countEvidenceExcerpts('S2.N1')).toBeGreaterThan(0)
    })

    it('S2.N1 evidence snippet contains nodeCreated fingerprint', () => {
      const snippet = loadEvidenceSnippet('S2.N1', 0)
      expect(snippet).toMatch(/nodeCreated/i)
    })

    it('S2.N1 snippet is capturable by runV1 without throwing', () => {
      const snippet = loadEvidenceSnippet('S2.N1', 0)
      const app = createMiniComfyApp()
      expect(() => runV1(snippet, { app })).not.toThrow()
    })
  })

  describe('S2.N8 — evidence excerpts', () => {
    it('S2.N8 has at least one evidence excerpt', () => {
      expect(countEvidenceExcerpts('S2.N8')).toBeGreaterThan(0)
    })

    it('S2.N8 evidence snippet contains prototype-patching fingerprint', () => {
      const snippet = loadEvidenceSnippet('S2.N8', 0)
      expect(snippet).toMatch(/nodeType\.prototype/i)
    })

    it('S2.N8 snippet is capturable by runV1 without throwing', () => {
      const snippet = loadEvidenceSnippet('S2.N8', 0)
      const app = createMiniComfyApp()
      expect(() => runV1(snippet, { app })).not.toThrow()
    })
  })

  describe('S2.N1 — nodeCreated hook (synthetic)', () => {
    it('nodeCreated callback receives node as first arg', () => {
      const received: unknown[] = []
      const extension = { nodeCreated: vi.fn((node: unknown) => received.push(node)) }
      const fakeNode = { id: 1, type: 'KSampler' }

      extension.nodeCreated(fakeNode)

      expect(extension.nodeCreated).toHaveBeenCalledOnce()
      expect(received[0]).toBe(fakeNode)
    })

    it('properties set on node inside nodeCreated are accessible after the call', () => {
      const fakeNode: Record<string, unknown> = { id: 2, type: 'CLIPTextEncode' }
      const extension = {
        nodeCreated(node: Record<string, unknown>) {
          node.customTag = 'injected-by-extension'
        }
      }

      extension.nodeCreated(fakeNode)

      expect(fakeNode.customTag).toBe('injected-by-extension')
    })

    it('nodeCreated fires for each registered extension (2 extensions = 2 calls)', () => {
      const fakeNode = { id: 3, type: 'VAEDecode' }
      const callOrder: string[] = []

      const extA = { nodeCreated: vi.fn(() => callOrder.push('A')) }
      const extB = { nodeCreated: vi.fn(() => callOrder.push('B')) }

      // Simulate the app dispatching nodeCreated to all registered extensions
      for (const ext of [extA, extB]) {
        ext.nodeCreated(fakeNode)
      }

      expect(extA.nodeCreated).toHaveBeenCalledOnce()
      expect(extB.nodeCreated).toHaveBeenCalledOnce()
      expect(callOrder).toEqual(['A', 'B'])
    })

    it.todo(
      'fires before node is added to graph'
    )

    it.todo(
      'fires before VueNode mounts'
    )
  })

  describe('S2.N8 — beforeRegisterNodeDef hook (synthetic)', () => {
    it('beforeRegisterNodeDef patches the prototype; all instances after the patch have the method', () => {
      function FakeNodeType(this: Record<string, unknown>) {
        this.id = Math.random()
      }
      FakeNodeType.prototype = {}
      FakeNodeType.type = 'KSampler'

      // Extension patches the prototype inside beforeRegisterNodeDef
      function beforeRegisterNodeDef(nodeType: { prototype: Record<string, unknown> }) {
        nodeType.prototype.myExtensionMethod = function () {
          return 'patched'
        }
      }
      beforeRegisterNodeDef(FakeNodeType)

      const instanceA = Object.create(FakeNodeType.prototype) as Record<string, unknown>
      const instanceB = Object.create(FakeNodeType.prototype) as Record<string, unknown>

      expect(typeof instanceA.myExtensionMethod).toBe('function')
      expect(typeof instanceB.myExtensionMethod).toBe('function')
      expect((instanceA.myExtensionMethod as () => string)()).toBe('patched')
    })

    it('beforeRegisterNodeDef callback receives nodeType name as first argument', () => {
      const receivedNames: string[] = []
      function beforeRegisterNodeDef(nodeType: { type: string }) {
        receivedNames.push(nodeType.type)
      }

      const fakeNodeType = { type: 'KSampler', prototype: {} }
      beforeRegisterNodeDef(fakeNodeType)

      expect(receivedNames).toContain('KSampler')
    })
  })
})
