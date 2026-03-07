import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useNodeDisplayStore } from '@/stores/nodeDisplayStore'
import type { UUID } from '@/lib/litegraph/src/utils/uuid'
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

const TEST_GRAPH_ID = 'test-graph-id' as UUID

function attachMockGraph(node: LGraphNode): void {
  node.graph = {
    _version: 0,
    rootGraph: { id: TEST_GRAPH_ID }
  } as unknown as LGraphNode['graph']
}

describe('LGraphNode presentation tracking', () => {
  let node: LGraphNode
  let store: ReturnType<typeof useNodeDisplayStore>

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useNodeDisplayStore()

    Object.assign(LiteGraph, {
      NODE_TITLE_HEIGHT: 20,
      NODE_SLOT_HEIGHT: 15,
      NODE_TEXT_SIZE: 14
    })

    node = new LGraphNode('TestNode')
    node.id = 1
    attachMockGraph(node)

    store.registerNode(TEST_GRAPH_ID, '1', {
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
      expect(store.getNode(TEST_GRAPH_ID, '1')?.flags.collapsed).toBe(true)
    })

    it('pinned = true propagates to store', () => {
      node.flags.pinned = true
      expect(store.getNode(TEST_GRAPH_ID, '1')?.flags.pinned).toBe(true)
    })

    it('ghost = true propagates to store', () => {
      node.flags.ghost = true
      expect(store.getNode(TEST_GRAPH_ID, '1')?.flags.ghost).toBe(true)
    })

    it('setting flag back to undefined propagates to store', () => {
      node.flags.collapsed = true
      expect(store.getNode(TEST_GRAPH_ID, '1')?.flags.collapsed).toBe(true)

      node.flags.collapsed = undefined
      expect(store.getNode(TEST_GRAPH_ID, '1')?.flags.collapsed).toBeUndefined()
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
      expect(store.getNode(TEST_GRAPH_ID, '1')?.title).toBe('New')
    })

    it('mode setter syncs to store', () => {
      node.mode = 2
      expect(store.getNode(TEST_GRAPH_ID, '1')?.mode).toBe(2)
    })

    it('color setter syncs to store', () => {
      node.color = '#ff0000'
      expect(store.getNode(TEST_GRAPH_ID, '1')?.color).toBe('#ff0000')
    })

    it('bgcolor setter syncs to store', () => {
      node.bgcolor = '#00ff00'
      expect(store.getNode(TEST_GRAPH_ID, '1')?.bgcolor).toBe('#00ff00')
    })

    it('shape setter converts string and syncs to store', () => {
      node.shape = 'round'
      expect(store.getNode(TEST_GRAPH_ID, '1')?.shape).toBe(RenderShape.ROUND)
    })

    it('showAdvanced setter syncs to store', () => {
      node.showAdvanced = true
      expect(store.getNode(TEST_GRAPH_ID, '1')?.showAdvanced).toBe(true)
    })

    it('same-value title assignment does not call syncDisplayStore', () => {
      node.title = 'X'
      expect(store.getNode(TEST_GRAPH_ID, '1')?.title).toBe('X')

      const syncSpy = vi.spyOn(
        node as unknown as Record<string, (...args: unknown[]) => void>,
        'syncDisplayStore'
      )
      node.title = 'X'

      expect(syncSpy).not.toHaveBeenCalled()
    })
  })
})
