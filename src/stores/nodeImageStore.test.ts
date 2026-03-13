import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { NodeLocatorId } from '@/types/nodeIdentification'

import { setNodeLocatorResolver, useNodeImageStore } from './nodeImageStore'

const mockNodeToNodeLocatorId = vi.fn()

function createMockNode(overrides: Record<string, unknown> = {}): LGraphNode {
  return {
    id: 1,
    type: 'TestNode',
    ...overrides
  } as Partial<LGraphNode> as LGraphNode
}

describe(useNodeImageStore, () => {
  let store: ReturnType<typeof useNodeImageStore>
  const locatorA = '42' as NodeLocatorId
  const locatorB = 'abc-123:42' as NodeLocatorId

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useNodeImageStore()
    vi.clearAllMocks()
    setNodeLocatorResolver(mockNodeToNodeLocatorId)
  })

  describe('getState', () => {
    it('returns default state for new locatorId', () => {
      const state = store.getState(locatorA)
      expect(state).toEqual({
        imgs: [],
        imageIndex: null,
        imageRects: [],
        pointerDown: null,
        overIndex: null
      })
    })

    it('returns same state for same locatorId', () => {
      const first = store.getState(locatorA)
      first.overIndex = 42
      const second = store.getState(locatorA)
      expect(second.overIndex).toBe(42)
    })

    it('returns different references for different locatorIds', () => {
      const a = store.getState(locatorA)
      const b = store.getState(locatorB)
      expect(a).not.toBe(b)
    })
  })

  describe('clearState', () => {
    it('removes entry for locatorId', () => {
      const state = store.getState(locatorA)
      state.overIndex = 5
      store.clearState(locatorA)

      const fresh = store.getState(locatorA)
      expect(fresh.overIndex).toBeNull()
    })
  })

  describe('clearAll', () => {
    it('removes all entries', () => {
      store.getState(locatorA).overIndex = 1
      store.getState(locatorB).overIndex = 2
      store.clearAll()

      expect(store.getState(locatorA).overIndex).toBeNull()
      expect(store.getState(locatorB).overIndex).toBeNull()
    })
  })

  describe('installPropertyProjection', () => {
    it('projects imageRects reads/writes to store', () => {
      const node = createMockNode()
      mockNodeToNodeLocatorId.mockReturnValue(locatorA)

      store.installPropertyProjection(node)

      node.imageRects = [[10, 20, 30, 40]]
      expect(store.getState(locatorA).imageRects).toEqual([[10, 20, 30, 40]])
      expect(node.imageRects).toEqual([[10, 20, 30, 40]])
    })

    it('projects pointerDown reads/writes to store', () => {
      const node = createMockNode()
      mockNodeToNodeLocatorId.mockReturnValue(locatorA)

      store.installPropertyProjection(node)

      node.pointerDown = { index: 3, pos: [100, 200] }
      expect(store.getState(locatorA).pointerDown).toEqual({
        index: 3,
        pos: [100, 200]
      })
      expect(node.pointerDown).toEqual({ index: 3, pos: [100, 200] })
    })

    it('projects overIndex reads/writes to store', () => {
      const node = createMockNode()
      mockNodeToNodeLocatorId.mockReturnValue(locatorA)

      store.installPropertyProjection(node)

      node.overIndex = 7
      expect(store.getState(locatorA).overIndex).toBe(7)
      expect(node.overIndex).toBe(7)
    })

    it('projects imageIndex reads/writes to store', () => {
      const node = createMockNode()
      mockNodeToNodeLocatorId.mockReturnValue(locatorA)

      store.installPropertyProjection(node)

      node.imageIndex = 5
      expect(store.getState(locatorA).imageIndex).toBe(5)
      expect(node.imageIndex).toBe(5)
    })

    it('preserves existing values when installing projection', () => {
      const node = createMockNode({ overIndex: 3, imageIndex: 2 })
      mockNodeToNodeLocatorId.mockReturnValue(locatorA)

      store.installPropertyProjection(node)

      expect(node.overIndex).toBe(3)
      expect(node.imageIndex).toBe(2)
      expect(store.getState(locatorA).overIndex).toBe(3)
      expect(store.getState(locatorA).imageIndex).toBe(2)
    })

    it('returns undefined when node has no locatorId', () => {
      const node = createMockNode()
      mockNodeToNodeLocatorId.mockReturnValue(undefined)

      store.installPropertyProjection(node)

      expect(node.overIndex).toBeUndefined()
      expect(node.imageIndex).toBeUndefined()
    })

    it('silently drops writes when node has no locatorId', () => {
      const node = createMockNode()
      mockNodeToNodeLocatorId.mockReturnValue(undefined)

      store.installPropertyProjection(node)
      node.overIndex = 5

      expect(node.overIndex).toBeUndefined()
    })

    it('is idempotent when called twice on the same node', () => {
      const node = createMockNode()
      mockNodeToNodeLocatorId.mockReturnValue(locatorA)

      store.installPropertyProjection(node)
      node.overIndex = 3
      node.imageIndex = 7
      node.imgs = [new Image()]

      store.installPropertyProjection(node)

      expect(node.overIndex).toBe(3)
      expect(node.imageIndex).toBe(7)
      expect(node.imgs).toHaveLength(1)
      expect(store.getState(locatorA).overIndex).toBe(3)
    })
  })

  describe('imgs projection', () => {
    it('returns undefined when store array is empty', () => {
      const node = createMockNode()
      mockNodeToNodeLocatorId.mockReturnValue(locatorA)

      store.installPropertyProjection(node)

      expect(node.imgs).toBeUndefined()
    })

    it('returns the array when store has images', () => {
      const node = createMockNode()
      mockNodeToNodeLocatorId.mockReturnValue(locatorA)

      store.installPropertyProjection(node)

      const img = new Image()
      node.imgs = [img]
      expect(node.imgs).toEqual([img])
      expect(store.getState(locatorA).imgs).toEqual([img])
    })

    it('converts undefined assignment to empty array in store', () => {
      const node = createMockNode()
      mockNodeToNodeLocatorId.mockReturnValue(locatorA)

      store.installPropertyProjection(node)

      node.imgs = [new Image()]
      node.imgs = undefined
      expect(node.imgs).toBeUndefined()
      expect(store.getState(locatorA).imgs).toEqual([])
    })

    it('preserves existing imgs when installing projection', () => {
      const img = new Image()
      const node = createMockNode({ imgs: [img] })
      mockNodeToNodeLocatorId.mockReturnValue(locatorA)

      store.installPropertyProjection(node)

      expect(node.imgs).toEqual([img])
      expect(store.getState(locatorA).imgs).toEqual([img])
    })

    it('supports optional chaining pattern (node.imgs?.length)', () => {
      const node = createMockNode()
      mockNodeToNodeLocatorId.mockReturnValue(locatorA)

      store.installPropertyProjection(node)

      expect(node.imgs?.length).toBeUndefined()

      node.imgs = [new Image(), new Image()]
      expect(node.imgs?.length).toBe(2)
    })
  })

  describe('subgraph isolation', () => {
    it('isolates image state across subgraph instances', () => {
      const locator1 = 'uuid-instance-1:42' as NodeLocatorId
      const locator2 = 'uuid-instance-2:42' as NodeLocatorId

      const img1 = new Image()
      const img2 = new Image()

      store.getState(locator1).imgs = [img1]
      store.getState(locator2).imgs = [img2]

      expect(store.getState(locator1).imgs).toEqual([img1])
      expect(store.getState(locator2).imgs).toEqual([img2])
    })

    it('isolates imageIndex across subgraph instances', () => {
      const locator1 = 'uuid-instance-1:42' as NodeLocatorId
      const locator2 = 'uuid-instance-2:42' as NodeLocatorId

      store.getState(locator1).imageIndex = 0
      store.getState(locator2).imageIndex = 3

      expect(store.getState(locator1).imageIndex).toBe(0)
      expect(store.getState(locator2).imageIndex).toBe(3)
    })

    it('projects to correct store entry based on locatorId', () => {
      const locator1 = 'uuid-instance-1:42' as NodeLocatorId
      const locator2 = 'uuid-instance-2:42' as NodeLocatorId

      const node1 = createMockNode({ id: 42, _locator: locator1 })
      const node2 = createMockNode({ id: 42, _locator: locator2 })

      mockNodeToNodeLocatorId.mockImplementation(
        (n: Record<string, unknown>) => n._locator
      )

      store.installPropertyProjection(node1)
      store.installPropertyProjection(node2)

      node1.overIndex = 1
      node2.overIndex = 9

      expect(store.getState(locator1).overIndex).toBe(1)
      expect(store.getState(locator2).overIndex).toBe(9)
    })
  })

  describe('multiple nodes have independent state', () => {
    it('imageIndex is independent per node', () => {
      const nodeA = createMockNode({ id: 1, _locator: '1' })
      const nodeB = createMockNode({ id: 2, _locator: '2' })
      const locA = '1' as NodeLocatorId
      const locB = '2' as NodeLocatorId

      mockNodeToNodeLocatorId.mockImplementation(
        (n: Record<string, unknown>) => n._locator
      )

      store.installPropertyProjection(nodeA)
      store.installPropertyProjection(nodeB)

      nodeA.imageIndex = 0
      nodeB.imageIndex = 5

      expect(nodeA.imageIndex).toBe(0)
      expect(nodeB.imageIndex).toBe(5)
      expect(store.getState(locA).imageIndex).toBe(0)
      expect(store.getState(locB).imageIndex).toBe(5)
    })
  })

  describe('DEFAULT_STATE immutability', () => {
    it('default imageRects is frozen and cannot be mutated', () => {
      const node = createMockNode()
      mockNodeToNodeLocatorId.mockReturnValue(locatorA)

      store.installPropertyProjection(node)

      // Read default imageRects without triggering state creation
      const nodeB = createMockNode()
      mockNodeToNodeLocatorId.mockReturnValue(locatorB)
      store.installPropertyProjection(nodeB)

      // Default arrays should be frozen (no state entry exists yet)
      expect(() => {
        ;(nodeB.imageRects as unknown[]).push([0, 0, 10, 10])
      }).toThrow()
    })
  })

  describe('null-to-null transitions', () => {
    it('imageIndex null → null works', () => {
      const node = createMockNode()
      mockNodeToNodeLocatorId.mockReturnValue(locatorA)

      store.installPropertyProjection(node)

      expect(node.imageIndex).toBeNull()
      node.imageIndex = null
      expect(node.imageIndex).toBeNull()
    })

    it('pointerDown null → null works', () => {
      const node = createMockNode()
      mockNodeToNodeLocatorId.mockReturnValue(locatorA)

      store.installPropertyProjection(node)

      expect(node.pointerDown).toBeNull()
      node.pointerDown = null
      expect(node.pointerDown).toBeNull()
    })
  })
})
