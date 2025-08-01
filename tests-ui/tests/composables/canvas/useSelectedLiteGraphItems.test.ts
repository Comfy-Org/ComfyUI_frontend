import { Positionable, Reroute } from '@comfyorg/litegraph'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSelectedLiteGraphItems } from '@/composables/canvas/useSelectedLiteGraphItems'
import { useCanvasStore } from '@/stores/graphStore'

// Mock the litegraph module
vi.mock('@comfyorg/litegraph', () => ({
  Reroute: class Reroute {
    constructor() {}
  }
}))

// Mock Positionable objects
// @ts-expect-error - Mock implementation for testing
class MockNode implements Positionable {
  pos: [number, number]
  size: [number, number]

  constructor(
    pos: [number, number] = [0, 0],
    size: [number, number] = [100, 100]
  ) {
    this.pos = pos
    this.size = size
  }
}

class MockReroute extends Reroute implements Positionable {
  // @ts-expect-error - Override for testing
  override pos: [number, number]
  size: [number, number]

  constructor(
    pos: [number, number] = [0, 0],
    size: [number, number] = [20, 20]
  ) {
    // @ts-expect-error - Mock constructor
    super()
    this.pos = pos
    this.size = size
  }
}

describe('useSelectedLiteGraphItems', () => {
  let canvasStore: ReturnType<typeof useCanvasStore>
  let mockCanvas: any

  beforeEach(() => {
    setActivePinia(createPinia())
    canvasStore = useCanvasStore()

    // Mock canvas with selectedItems Set
    mockCanvas = {
      selectedItems: new Set<Positionable>()
    }

    // Mock getCanvas to return our mock canvas
    vi.spyOn(canvasStore, 'getCanvas').mockReturnValue(mockCanvas)
  })

  describe('isIgnoredItem', () => {
    it('should return true for Reroute instances', () => {
      const { isIgnoredItem } = useSelectedLiteGraphItems()
      const reroute = new MockReroute()
      expect(isIgnoredItem(reroute)).toBe(true)
    })

    it('should return false for non-Reroute items', () => {
      const { isIgnoredItem } = useSelectedLiteGraphItems()
      const node = new MockNode()
      // @ts-expect-error - Test mock
      expect(isIgnoredItem(node)).toBe(false)
    })
  })

  describe('filterSelectableItems', () => {
    it('should filter out Reroute items', () => {
      const { filterSelectableItems } = useSelectedLiteGraphItems()
      const node1 = new MockNode([0, 0])
      const node2 = new MockNode([100, 100])
      const reroute = new MockReroute([50, 50])

      // @ts-expect-error - Test mocks
      const items = new Set<Positionable>([node1, node2, reroute])
      const filtered = filterSelectableItems(items)

      expect(filtered.size).toBe(2)
      // @ts-expect-error - Test mocks
      expect(filtered.has(node1)).toBe(true)
      // @ts-expect-error - Test mocks
      expect(filtered.has(node2)).toBe(true)
      expect(filtered.has(reroute)).toBe(false)
    })

    it('should return empty set when all items are ignored', () => {
      const { filterSelectableItems } = useSelectedLiteGraphItems()
      const reroute1 = new MockReroute([0, 0])
      const reroute2 = new MockReroute([50, 50])

      const items = new Set<Positionable>([reroute1, reroute2])
      const filtered = filterSelectableItems(items)

      expect(filtered.size).toBe(0)
    })

    it('should handle empty set', () => {
      const { filterSelectableItems } = useSelectedLiteGraphItems()
      const items = new Set<Positionable>()
      const filtered = filterSelectableItems(items)

      expect(filtered.size).toBe(0)
    })
  })

  describe('methods', () => {
    it('getSelectableItems should return only non-ignored items', () => {
      const { getSelectableItems } = useSelectedLiteGraphItems()
      const node1 = new MockNode()
      const node2 = new MockNode()
      const reroute = new MockReroute()

      mockCanvas.selectedItems.add(node1)
      mockCanvas.selectedItems.add(node2)
      mockCanvas.selectedItems.add(reroute)

      const selectableItems = getSelectableItems()
      expect(selectableItems.size).toBe(2)
      // @ts-expect-error - Test mock
      expect(selectableItems.has(node1)).toBe(true)
      // @ts-expect-error - Test mock
      expect(selectableItems.has(node2)).toBe(true)
      expect(selectableItems.has(reroute)).toBe(false)
    })

    it('hasSelectableItems should be true when there are selectable items', () => {
      const { hasSelectableItems } = useSelectedLiteGraphItems()
      const node = new MockNode()

      expect(hasSelectableItems()).toBe(false)

      mockCanvas.selectedItems.add(node)
      expect(hasSelectableItems()).toBe(true)
    })

    it('hasSelectableItems should be false when only ignored items are selected', () => {
      const { hasSelectableItems } = useSelectedLiteGraphItems()
      const reroute = new MockReroute()

      mockCanvas.selectedItems.add(reroute)
      expect(hasSelectableItems()).toBe(false)
    })

    it('hasMultipleSelectableItems should be true when there are 2+ selectable items', () => {
      const { hasMultipleSelectableItems } = useSelectedLiteGraphItems()
      const node1 = new MockNode()
      const node2 = new MockNode()

      expect(hasMultipleSelectableItems()).toBe(false)

      mockCanvas.selectedItems.add(node1)
      expect(hasMultipleSelectableItems()).toBe(false)

      mockCanvas.selectedItems.add(node2)
      expect(hasMultipleSelectableItems()).toBe(true)
    })

    it('hasMultipleSelectableItems should not count ignored items', () => {
      const { hasMultipleSelectableItems } = useSelectedLiteGraphItems()
      const node = new MockNode()
      const reroute1 = new MockReroute()
      const reroute2 = new MockReroute()

      mockCanvas.selectedItems.add(node)
      mockCanvas.selectedItems.add(reroute1)
      mockCanvas.selectedItems.add(reroute2)

      // Even though there are 3 items total, only 1 is selectable
      expect(hasMultipleSelectableItems()).toBe(false)
    })
  })

  describe('dynamic behavior', () => {
    it('methods should reflect changes when selectedItems change', () => {
      const {
        getSelectableItems,
        hasSelectableItems,
        hasMultipleSelectableItems
      } = useSelectedLiteGraphItems()
      const node1 = new MockNode()
      const node2 = new MockNode()

      expect(hasSelectableItems()).toBe(false)
      expect(hasMultipleSelectableItems()).toBe(false)

      // Add first node
      mockCanvas.selectedItems.add(node1)
      expect(hasSelectableItems()).toBe(true)
      expect(hasMultipleSelectableItems()).toBe(false)
      expect(getSelectableItems().size).toBe(1)

      // Add second node
      mockCanvas.selectedItems.add(node2)
      expect(hasSelectableItems()).toBe(true)
      expect(hasMultipleSelectableItems()).toBe(true)
      expect(getSelectableItems().size).toBe(2)

      // Remove a node
      mockCanvas.selectedItems.delete(node1)
      expect(hasSelectableItems()).toBe(true)
      expect(hasMultipleSelectableItems()).toBe(false)
      expect(getSelectableItems().size).toBe(1)
    })
  })
})
