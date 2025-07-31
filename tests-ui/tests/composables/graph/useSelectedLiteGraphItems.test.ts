import { Positionable, Reroute } from '@comfyorg/litegraph'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { markRaw } from 'vue'

import { useSelectedLiteGraphItems } from '@/composables/graph/useSelectedLiteGraphItems'
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

  beforeEach(() => {
    setActivePinia(createPinia())
    canvasStore = useCanvasStore()

    // Initialize selectedItems as empty array
    canvasStore.selectedItems = []
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

  describe('computed properties', () => {
    it('selectedItems should return all selected items from store', () => {
      const { selectedItems } = useSelectedLiteGraphItems()
      const node = markRaw(new MockNode())
      const reroute = markRaw(new MockReroute())

      // @ts-expect-error - Test data
      canvasStore.selectedItems = [node, reroute]

      expect(selectedItems.value.length).toBe(2)
      expect(selectedItems.value[0]).toBe(node)
      expect(selectedItems.value[1]).toBe(reroute)
    })

    it('selectableItems should return only non-ignored items', () => {
      const { selectableItems } = useSelectedLiteGraphItems()
      const node1 = markRaw(new MockNode())
      const node2 = markRaw(new MockNode())
      const reroute = markRaw(new MockReroute())

      // @ts-expect-error - Test data
      canvasStore.selectedItems = [node1, node2, reroute]

      expect(selectableItems.value.size).toBe(2)
      const selectableArray = Array.from(selectableItems.value)
      expect(selectableArray).toContain(node1)
      expect(selectableArray).toContain(node2)
      expect(selectableArray).not.toContain(reroute)
    })

    it('hasSelectableItems should be true when there are selectable items', () => {
      const { hasSelectableItems } = useSelectedLiteGraphItems()
      const node = markRaw(new MockNode())

      expect(hasSelectableItems.value).toBe(false)

      // @ts-expect-error - Test data
      canvasStore.selectedItems = [node]
      expect(hasSelectableItems.value).toBe(true)
    })

    it('hasSelectableItems should be false when only ignored items are selected', () => {
      const { hasSelectableItems } = useSelectedLiteGraphItems()
      const reroute = markRaw(new MockReroute())

      canvasStore.selectedItems = [reroute]
      expect(hasSelectableItems.value).toBe(false)
    })

    it('hasMultipleSelectableItems should be true when there are 2+ selectable items', () => {
      const { hasMultipleSelectableItems } = useSelectedLiteGraphItems()
      const node1 = markRaw(new MockNode())
      const node2 = markRaw(new MockNode())

      expect(hasMultipleSelectableItems.value).toBe(false)

      // @ts-expect-error - Test data
      canvasStore.selectedItems = [node1]
      expect(hasMultipleSelectableItems.value).toBe(false)

      // @ts-expect-error - Test data
      canvasStore.selectedItems = [node1, node2]
      expect(hasMultipleSelectableItems.value).toBe(true)
    })

    it('hasMultipleSelectableItems should not count ignored items', () => {
      const { hasMultipleSelectableItems } = useSelectedLiteGraphItems()
      const node = markRaw(new MockNode())
      const reroute1 = markRaw(new MockReroute())
      const reroute2 = markRaw(new MockReroute())

      // @ts-expect-error - Test data
      canvasStore.selectedItems = [node, reroute1, reroute2]

      // Even though there are 3 items total, only 1 is selectable
      expect(hasMultipleSelectableItems.value).toBe(false)
    })
  })

  describe('reactivity', () => {
    it('computed properties should update when selectedItems change', () => {
      const {
        selectableItems,
        hasSelectableItems,
        hasMultipleSelectableItems
      } = useSelectedLiteGraphItems()
      const node1 = markRaw(new MockNode())
      const node2 = markRaw(new MockNode())

      expect(hasSelectableItems.value).toBe(false)
      expect(hasMultipleSelectableItems.value).toBe(false)

      // Add first node
      // @ts-expect-error - Test data
      canvasStore.selectedItems = [node1]
      expect(hasSelectableItems.value).toBe(true)
      expect(hasMultipleSelectableItems.value).toBe(false)
      expect(selectableItems.value.size).toBe(1)

      // Add second node
      // @ts-expect-error - Test data
      canvasStore.selectedItems = [node1, node2]
      expect(hasSelectableItems.value).toBe(true)
      expect(hasMultipleSelectableItems.value).toBe(true)
      expect(selectableItems.value.size).toBe(2)

      // Remove a node
      // @ts-expect-error - Test data
      canvasStore.selectedItems = [node2]
      expect(hasSelectableItems.value).toBe(true)
      expect(hasMultipleSelectableItems.value).toBe(false)
      expect(selectableItems.value.size).toBe(1)
    })
  })
})
