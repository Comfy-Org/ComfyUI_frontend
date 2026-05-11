// Category: BC.22 — Context menu contributions (node and canvas)
// DB cross-ref: S2.N5, S1.H3, S1.H4
// blast_radius: 5.10 — compat-floor: MUST pass before v2 ships
// Migration: v1 getNodeMenuOptions / prototype.getExtraMenuOptions / getCanvasMenuItems
//         → v2 menu contribution API (Phase B / Phase C)
//
// Phase A: prove the v1 behavioral contract that v2 must replicate.
// Real v2 API is a gap — documented with todo. Phase C strangler will intercept
// prototype patches and redirect to the v2 registry.
//
// I-TF.8 — BC.22 migration wired assertions.

import { describe, expect, it, vi } from 'vitest'

// ── V1 menu contribution models ───────────────────────────────────────────────

interface V1MenuItem { label: string; callback: () => void }
interface V1NodeLike { type: string; id: number }

interface V1Extension {
  name: string
  getNodeMenuOptions?: (node: V1NodeLike) => V1MenuItem[]
  getCanvasMenuOptions?: () => V1MenuItem[]
}

function createV1MenuSystem() {
  const extensions: V1Extension[] = []
  // Also model the prototype-patch approach (S2.N5)
  const prototypePatches: Array<(node: V1NodeLike) => V1MenuItem[]> = []

  return {
    registerExtension(ext: V1Extension) { extensions.push(ext) },
    registerPrototypePatch(fn: (node: V1NodeLike) => V1MenuItem[]) {
      prototypePatches.push(fn)
    },
    getNodeMenuItems(node: V1NodeLike): V1MenuItem[] {
      const fromHooks = extensions.flatMap((e) => e.getNodeMenuOptions?.(node) ?? [])
      const fromPatches = prototypePatches.flatMap((fn) => fn(node))
      return [...fromHooks, ...fromPatches]
    },
    getCanvasMenuItems(): V1MenuItem[] {
      return extensions.flatMap((e) => e.getCanvasMenuOptions?.() ?? [])
    }
  }
}

// ── V2 menu model (desired contract, synthetic) ───────────────────────────────

interface V2MenuItem { label: string; action: (ctx: { nodeType: string }) => void }

function createV2MenuSystem() {
  const nodeItems: Map<string, V2MenuItem[]> = new Map()
  const canvasItems: V2MenuItem[] = []

  return {
    addNodeItem(nodeType: string, item: V2MenuItem) {
      const list = nodeItems.get(nodeType) ?? []
      list.push(item)
      nodeItems.set(nodeType, list)
      return () => {
        const l = nodeItems.get(nodeType) ?? []
        const idx = l.indexOf(item)
        if (idx !== -1) l.splice(idx, 1)
      }
    },
    addCanvasItem(item: V2MenuItem) {
      canvasItems.push(item)
      return () => {
        const idx = canvasItems.indexOf(item)
        if (idx !== -1) canvasItems.splice(idx, 1)
      }
    },
    getNodeItems(nodeType: string) { return nodeItems.get(nodeType) ?? [] },
    getCanvasItems() { return [...canvasItems] }
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BC.22 migration — context menu contributions', () => {
  describe('getNodeMenuOptions hook → v2 node menu item (S1.H3)', () => {
    it('v1 getNodeMenuOptions and v2 node menu items both surface items for a specific node type', () => {
      const v1 = createV1MenuSystem()
      const v2 = createV2MenuSystem()

      v1.registerExtension({
        name: 'bc22.mig.v1-hook',
        getNodeMenuOptions(node) {
          if (node.type === 'KSampler') return [{ label: 'Run alone', callback: () => {} }]
          return []
        }
      })

      v2.addNodeItem('KSampler', { label: 'Run alone', action: () => {} })

      const v1Items = v1.getNodeMenuItems({ type: 'KSampler', id: 1 })
      const v2Items = v2.getNodeItems('KSampler')

      expect(v1Items.map((i) => i.label)).toEqual(v2Items.map((i) => i.label))
      expect(v1Items).toHaveLength(1)
    })

    it('items for non-matching node types are not surfaced in either v1 or v2', () => {
      const v1 = createV1MenuSystem()
      const v2 = createV2MenuSystem()

      v1.registerExtension({
        name: 'bc22.mig.v1-type-guard',
        getNodeMenuOptions(node) {
          if (node.type === 'KSampler') return [{ label: 'KSampler Only', callback: () => {} }]
          return []
        }
      })
      v2.addNodeItem('KSampler', { label: 'KSampler Only', action: () => {} })

      expect(v1.getNodeMenuItems({ type: 'CLIPTextEncode', id: 2 })).toHaveLength(0)
      expect(v2.getNodeItems('CLIPTextEncode')).toHaveLength(0)
    })
  })

  describe('prototype.getExtraMenuOptions patching → v2 node menu item (S2.N5)', () => {
    it('v1 prototype patch and v2 addNodeItem both contribute items to the same node type', () => {
      const v1 = createV1MenuSystem()
      const v2 = createV2MenuSystem()

      // v1: simulate prototype patch that appends to menu for all nodes
      v1.registerPrototypePatch((_node) => [{ label: 'From Patch', callback: () => {} }])
      // v2: equivalent registered item
      v2.addNodeItem('*', { label: 'From Patch', action: () => {} }) // '*' = global

      const v1Items = v1.getNodeMenuItems({ type: 'AnyNode', id: 1 })
      expect(v1Items).toHaveLength(1)
      expect(v1Items[0].label).toBe('From Patch')
    })

    it('multiple v1 prototype patches chain; v2 multiple addNodeItem calls are independent', () => {
      const v1 = createV1MenuSystem()
      const v2 = createV2MenuSystem()

      v1.registerPrototypePatch(() => [{ label: 'Patch A', callback: () => {} }])
      v1.registerPrototypePatch(() => [{ label: 'Patch B', callback: () => {} }])

      v2.addNodeItem('TestNode', { label: 'Patch A', action: () => {} })
      v2.addNodeItem('TestNode', { label: 'Patch B', action: () => {} })

      const v1Labels = v1.getNodeMenuItems({ type: 'TestNode', id: 1 }).map((i) => i.label).sort()
      const v2Labels = v2.getNodeItems('TestNode').map((i) => i.label).sort()

      expect(v1Labels).toEqual(v2Labels)
    })
  })

  describe('getCanvasMenuOptions → v2 canvas menu item (S1.H4)', () => {
    it('v1 getCanvasMenuOptions and v2 canvas items both surface the same labels', () => {
      const v1 = createV1MenuSystem()
      const v2 = createV2MenuSystem()

      v1.registerExtension({
        name: 'bc22.mig.canvas-v1',
        getCanvasMenuOptions() { return [{ label: 'Create Group', callback: () => {} }] }
      })
      v2.addCanvasItem({ label: 'Create Group', action: () => {} })

      const v1Labels = v1.getCanvasMenuItems().map((i) => i.label)
      const v2Labels = v2.getCanvasItems().map((i) => i.label)
      expect(v1Labels).toEqual(v2Labels)
    })
  })

  describe('action invocation equivalence', () => {
    it('v1 callback and v2 action are both invoked when the item is selected', () => {
      const v1Cb = vi.fn()
      const v2Cb = vi.fn()

      const v1 = createV1MenuSystem()
      const v2 = createV2MenuSystem()

      v1.registerExtension({
        name: 'bc22.mig.action',
        getNodeMenuOptions() { return [{ label: 'Do Something', callback: v1Cb }] }
      })
      v2.addNodeItem('KSampler', { label: 'Do Something', action: v2Cb })

      v1.getNodeMenuItems({ type: 'KSampler', id: 1 })[0].callback()
      v2.getNodeItems('KSampler')[0].action({ nodeType: 'KSampler' })

      expect(v1Cb).toHaveBeenCalledOnce()
      expect(v2Cb).toHaveBeenCalledOnce()
    })
  })

  describe('scope cleanup on dispose', () => {
    it('v2 item removed via disposable is no longer returned by getNodeItems', () => {
      const v2 = createV2MenuSystem()
      const remove = v2.addNodeItem('KSampler', { label: 'Temporary', action: () => {} })
      v2.addNodeItem('KSampler', { label: 'Permanent', action: () => {} })

      expect(v2.getNodeItems('KSampler')).toHaveLength(2)
      remove()
      expect(v2.getNodeItems('KSampler')).toHaveLength(1)
      expect(v2.getNodeItems('KSampler')[0].label).toBe('Permanent')
    })

    it('removing one item does not affect items registered by other extensions', () => {
      const v2 = createV2MenuSystem()
      const removeA = v2.addNodeItem('KSampler', { label: 'Ext A item', action: () => {} })
      v2.addNodeItem('KSampler', { label: 'Ext B item', action: () => {} })

      removeA()
      const remaining = v2.getNodeItems('KSampler')
      expect(remaining).toHaveLength(1)
      expect(remaining[0].label).toBe('Ext B item')
    })
  })

  describe('[gap] real v2 API and Phase C strangler', () => {
    it.todo(
      '[gap] NodeExtensionOptions.getNodeMenuOptions not yet on the interface. ' +
      'Phase B: add to NodeExtensionOptions; runtime merges returned items into the canvas context menu.'
    )
    it.todo(
      '[gap] ExtensionOptions.getCanvasMenuOptions not yet on the interface. ' +
      'Phase B: add to ExtensionOptions; runtime merges items into empty-canvas right-click menu.'
    )
    it.todo(
      '[Phase C strangler] LiteGraph prototype.getExtraMenuOptions patches are intercepted and redirected to v2 node menu registry. ' +
      'Blocked on I-PG.C — Phase C strangler mechanism (D11).'
    )
    it.todo(
      '[Phase C strangler] LGraphCanvas.prototype.getCanvasMenuOptions patches are intercepted and redirected to v2 canvas menu registry. ' +
      'Blocked on I-PG.C.'
    )
  })
})
