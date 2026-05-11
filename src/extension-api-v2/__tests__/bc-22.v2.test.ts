// Category: BC.22 — Context menu contributions (node and canvas)
// DB cross-ref: S2.N5, S1.H3, S1.H4
// blast_radius: 5.10 — compat-floor: MUST pass before v2 ships
//
// Phase A findings (from lifecycle.ts inspection):
// - NodeExtensionOptions has NO addContextMenuItem field.
// - ExtensionOptions has NO addCanvasMenuItem field.
// - Both are documented API gaps for Phase B / Phase C.
//
// What IS testable today: the v1 pattern shape (getNodeMenuOptions, getCanvasMenuItems,
// prototype.getExtraMenuOptions) can be exercised as synthetic stubs to prove the
// behavioral contract we need to replicate. The Phase B surface is marked todo.
//
// I-TF.8 — BC.22 v2 wired assertions.

import { describe, expect, it } from 'vitest'
import type { NodeExtensionOptions, ExtensionOptions } from '@/extension-api/lifecycle'

// ── Synthetic menu registry ───────────────────────────────────────────────────
// Models the desired v2 menu contribution surface without the real implementation.
// Used to verify registration contract shape when the API lands.

interface MenuItem {
  label: string
  action: (ctx: { type: string }) => void
}

function createNodeMenuRegistry() {
  const items: Map<string, MenuItem[]> = new Map() // keyed by nodeType

  return {
    addItem(nodeType: string, item: MenuItem) {
      const list = items.get(nodeType) ?? []
      list.push(item)
      items.set(nodeType, list)
      return () => {
        const l = items.get(nodeType) ?? []
        const idx = l.indexOf(item)
        if (idx !== -1) l.splice(idx, 1)
      }
    },
    getItems(nodeType: string) { return items.get(nodeType) ?? [] },
    clear() { items.clear() }
  }
}

function createCanvasMenuRegistry() {
  const items: MenuItem[] = []
  return {
    addItem(item: MenuItem) {
      items.push(item)
      return () => {
        const idx = items.indexOf(item)
        if (idx !== -1) items.splice(idx, 1)
      }
    },
    getItems() { return [...items] },
    clear() { items.length = 0 }
  }
}

// ── Wired assertions (Phase A — type-shape + synthetic menu contract) ─────────

describe('BC.22 v2 contract — context menu contributions', () => {
  describe('NodeExtensionOptions shape — gap documentation', () => {
    it('NodeExtensionOptions does not yet have addContextMenuItem — gap is documented', () => {
      const opts: NodeExtensionOptions = {
        name: 'bc22.test.node-menu',
        nodeTypes: ['KSampler'],
        nodeCreated(_node) {}
      }
      // Confirm: no addContextMenuItem on the interface (TypeScript would fail if we tried to access it).
      expect('addContextMenuItem' in opts).toBe(false)
    })

    it('ExtensionOptions does not yet have addCanvasMenuItem — gap is documented', () => {
      const opts: ExtensionOptions = {
        name: 'bc22.test.canvas-menu',
        setup() {}
      }
      expect('addCanvasMenuItem' in opts).toBe(false)
    })
  })

  describe('synthetic node menu registry — desired v2 contract shape', () => {
    it('addItem(nodeType, { label, action }) registers a menu item for that node type', () => {
      const reg = createNodeMenuRegistry()
      reg.addItem('KSampler', { label: 'My Action', action: () => {} })
      expect(reg.getItems('KSampler')).toHaveLength(1)
      expect(reg.getItems('KSampler')[0].label).toBe('My Action')
    })

    it('items for different node types are independent', () => {
      const reg = createNodeMenuRegistry()
      reg.addItem('KSampler', { label: 'A', action: () => {} })
      reg.addItem('CLIPTextEncode', { label: 'B', action: () => {} })
      expect(reg.getItems('KSampler')).toHaveLength(1)
      expect(reg.getItems('CLIPTextEncode')).toHaveLength(1)
      expect(reg.getItems('VAEDecode')).toHaveLength(0)
    })

    it('addItem returns a disposable that removes only that item', () => {
      const reg = createNodeMenuRegistry()
      const remove = reg.addItem('KSampler', { label: 'Removable', action: () => {} })
      reg.addItem('KSampler', { label: 'Stays', action: () => {} })
      expect(reg.getItems('KSampler')).toHaveLength(2)

      remove()
      expect(reg.getItems('KSampler')).toHaveLength(1)
      expect(reg.getItems('KSampler')[0].label).toBe('Stays')
    })

    it('calling disposable twice is safe (idempotent)', () => {
      const reg = createNodeMenuRegistry()
      const remove = reg.addItem('KSampler', { label: 'X', action: () => {} })
      expect(() => { remove(); remove() }).not.toThrow()
    })

    it('action callback receives context with node type', () => {
      const reg = createNodeMenuRegistry()
      const received: string[] = []
      reg.addItem('KSampler', { label: 'Test', action: (ctx) => received.push(ctx.type) })

      const items = reg.getItems('KSampler')
      items[0].action({ type: 'KSampler' })
      expect(received).toEqual(['KSampler'])
    })
  })

  describe('synthetic canvas menu registry — desired v2 contract shape', () => {
    it('addItem({ label, action }) registers a canvas menu item', () => {
      const reg = createCanvasMenuRegistry()
      reg.addItem({ label: 'Canvas Action', action: () => {} })
      expect(reg.getItems()).toHaveLength(1)
      expect(reg.getItems()[0].label).toBe('Canvas Action')
    })

    it('multiple canvas items are independent', () => {
      const reg = createCanvasMenuRegistry()
      reg.addItem({ label: 'A', action: () => {} })
      reg.addItem({ label: 'B', action: () => {} })
      expect(reg.getItems()).toHaveLength(2)
    })

    it('canvas menu item disposable removes only that item', () => {
      const reg = createCanvasMenuRegistry()
      const remove = reg.addItem({ label: 'Temporary', action: () => {} })
      reg.addItem({ label: 'Permanent', action: () => {} })
      remove()
      expect(reg.getItems()).toHaveLength(1)
      expect(reg.getItems()[0].label).toBe('Permanent')
    })
  })

  describe('[gap] real v2 API — Phase B / Phase C', () => {
    it.todo(
      '[gap] NodeExtensionOptions does not have addContextMenuItem. ' +
      'Phase B: add getNodeMenuOptions?(node: NodeHandle): MenuItem[] to NodeExtensionOptions. ' +
      'Or equivalent declarative form. Replaces S1.H3 (getNodeMenuItems hook) and S2.N5 (prototype.getExtraMenuOptions).'
    )
    it.todo(
      '[gap] ExtensionOptions does not have addCanvasMenuItem. ' +
      'Phase B: add getCanvasMenuOptions?(): MenuItem[] to ExtensionOptions. ' +
      'Replaces S1.H4 (getCanvasMenuItems hook).'
    )
    it.todo(
      '[Phase C strangler] prototype.getExtraMenuOptions patching (S2.N5) — ' +
      'intercepted by strangler and redirected to registered v2 menu items. ' +
      'Blocked on I-PG.C implementation.'
    )
    it.todo(
      '[Phase C strangler] LGraphCanvas.prototype.getCanvasMenuOptions patching — ' +
      'intercepted and redirected to v2 canvas menu registry. Phase C only.'
    )
  })
})
