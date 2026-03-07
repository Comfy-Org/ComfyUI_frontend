import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { nodePresentationStore } from '@/renderer/core/nodePresentation/store/nodePresentationStore'
import type { PresentationChange } from '@/renderer/core/nodePresentation/types'
import { RenderShape } from '@/lib/litegraph/src/types/globalEnums'

vi.mock('@/renderer/core/layout/store/layoutStore', () => ({
  layoutStore: {
    getNodeLayoutRef: vi.fn(() => ({
      value: {
        id: '1',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 50 },
        zIndex: 0,
        visible: true,
        bounds: { x: 0, y: 0, width: 100, height: 50 }
      }
    })),
    applyOperation: vi.fn(),
    getCurrentSource: vi.fn(() => 'canvas'),
    getCurrentActor: vi.fn(() => 'test'),
    setSource: vi.fn(),
    setActor: vi.fn(),
    batchUpdateNodeBounds: vi.fn()
  }
}))

describe('LGraphNode presentation tracking', () => {
  let node: LGraphNode

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))

    Object.assign(LiteGraph, {
      NODE_TITLE_HEIGHT: 20,
      NODE_SLOT_HEIGHT: 15,
      NODE_TEXT_SIZE: 14
    })

    nodePresentationStore.clear()

    node = new LGraphNode('TestNode')
    node.id = 1

    nodePresentationStore.initializeNode('1', {
      id: '1',
      title: 'TestNode',
      mode: 0,
      flags: {}
    })

    vi.clearAllMocks()
  })

  describe('flag mutation → store sync', () => {
    it('collapsed = true propagates to store', () => {
      node.flags.collapsed = true
      expect(nodePresentationStore.getNode('1')?.flags.collapsed).toBe(true)
    })

    it('pinned = true propagates to store', () => {
      node.flags.pinned = true
      expect(nodePresentationStore.getNode('1')?.flags.pinned).toBe(true)
    })

    it('ghost = true propagates to store', () => {
      node.flags.ghost = true
      expect(nodePresentationStore.getNode('1')?.flags.ghost).toBe(true)
    })

    it('setting flag back to undefined propagates to store', () => {
      node.flags.collapsed = true
      expect(nodePresentationStore.getNode('1')?.flags.collapsed).toBe(true)

      node.flags.collapsed = undefined
      expect(
        nodePresentationStore.getNode('1')?.flags.collapsed
      ).toBeUndefined()
    })

    it('onChange listener receives flag change events', () => {
      const changes: PresentationChange[] = []
      const unsub = nodePresentationStore.onChange((c) => changes.push(c))

      node.flags.ghost = true

      expect(changes).toHaveLength(1)
      expect(changes[0]).toMatchObject({
        type: 'update',
        nodeId: '1',
        property: 'flags'
      })

      unsub()
    })
  })

  describe('pinned → resizable side effect', () => {
    it('pinned = true sets resizable to false', () => {
      node.flags.pinned = true
      expect(node.resizable).toBe(false)
    })

    it('pinned = false restores resizable to true', () => {
      node.flags.pinned = true
      node.flags.pinned = false
      expect(node.resizable).toBe(true)
    })

    it('pinned = undefined restores resizable to true', () => {
      node.flags.pinned = true
      node.flags.pinned = undefined
      expect(node.resizable).toBe(true)
    })

    it('pin() method toggles pinned and resizable', () => {
      const graph = { _version: 0 }
      node.graph = graph as unknown as LGraphNode['graph']

      node.pin(true)
      expect(node.pinned).toBe(true)
      expect(node.resizable).toBe(false)

      node.pin(false)
      expect(node.pinned).toBe(false)
      expect(node.resizable).toBe(true)
    })
  })

  describe('serialization round-trip for flags', () => {
    it('ghost = true appears in serialized flags', () => {
      node.flags.ghost = true
      const serialized = node.serialize()
      expect(serialized.flags.ghost).toBe(true)
    })

    it('ghost set then cleared omits key from serialized flags', () => {
      node.flags.ghost = true
      node.flags.ghost = undefined
      const serialized = node.serialize()
      expect('ghost' in serialized.flags).toBe(false)
    })

    it('pinned set then cleared omits key from serialized flags', () => {
      node.flags.pinned = true
      node.flags.pinned = undefined
      const serialized = node.serialize()
      expect('pinned' in serialized.flags).toBe(false)
    })

    it('collapsed = true is serialized', () => {
      node.flags.collapsed = true
      const serialized = node.serialize()
      expect(serialized.flags.collapsed).toBe(true)
    })

    it('collapsed = false is serialized (false is still a value)', () => {
      node.flags.collapsed = true
      node.flags.collapsed = false
      const serialized = node.serialize()
      expect(serialized.flags.collapsed).toBe(false)
    })

    it('collapsed = undefined omits key from serialized flags', () => {
      node.flags.collapsed = true
      node.flags.collapsed = undefined
      const serialized = node.serialize()
      expect('collapsed' in serialized.flags).toBe(false)
    })
  })

  describe('presentation setter → store sync', () => {
    it('title setter syncs to store', () => {
      node.title = 'New'
      expect(nodePresentationStore.getNode('1')?.title).toBe('New')
    })

    it('mode setter syncs to store', () => {
      node.mode = 2
      expect(nodePresentationStore.getNode('1')?.mode).toBe(2)
    })

    it('color setter syncs to store', () => {
      node.color = '#ff0000'
      expect(nodePresentationStore.getNode('1')?.color).toBe('#ff0000')
    })

    it('bgcolor setter syncs to store', () => {
      node.bgcolor = '#00ff00'
      expect(nodePresentationStore.getNode('1')?.bgcolor).toBe('#00ff00')
    })

    it('shape setter converts string and syncs to store', () => {
      node.shape = 'round'
      expect(nodePresentationStore.getNode('1')?.shape).toBe(RenderShape.ROUND)
    })

    it('showAdvanced setter syncs to store', () => {
      node.showAdvanced = true
      expect(nodePresentationStore.getNode('1')?.showAdvanced).toBe(true)
    })

    it('same-value title assignment does not trigger onChange', () => {
      node.title = 'X'

      const changes: PresentationChange[] = []
      const unsub = nodePresentationStore.onChange((c) => changes.push(c))

      node.title = 'X'

      expect(changes).toHaveLength(0)
      unsub()
    })
  })
})
