import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSelectedLiteGraphItems } from '@/composables/canvas/useSelectedLiteGraphItems'
import {
  LGraphEventMode,
  LGraphNode,
  Positionable,
  Reroute
} from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import { useCanvasStore } from '@/stores/graphStore'

// Mock the app module
vi.mock('@/scripts/app', () => ({
  app: {
    canvas: {
      selected_nodes: null
    }
  }
}))

// Mock the litegraph module
vi.mock('@/lib/litegraph/src/litegraph', () => ({
  Reroute: class Reroute {
    constructor() {}
  },
  LGraphEventMode: {
    ALWAYS: 0,
    NEVER: 2,
    BYPASS: 4
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

  describe('node-specific methods', () => {
    it('getSelectedNodes should return only LGraphNode instances', () => {
      const { getSelectedNodes } = useSelectedLiteGraphItems()
      const node1 = { id: 1, mode: LGraphEventMode.ALWAYS } as LGraphNode
      const node2 = { id: 2, mode: LGraphEventMode.NEVER } as LGraphNode

      // Mock app.canvas.selected_nodes
      app.canvas.selected_nodes = { '0': node1, '1': node2 }

      const selectedNodes = getSelectedNodes()
      expect(selectedNodes).toHaveLength(2)
      expect(selectedNodes[0]).toBe(node1)
      expect(selectedNodes[1]).toBe(node2)
    })

    it('getSelectedNodes should return empty array when no nodes selected', () => {
      const { getSelectedNodes } = useSelectedLiteGraphItems()

      // @ts-expect-error - Testing null case
      app.canvas.selected_nodes = null

      const selectedNodes = getSelectedNodes()
      expect(selectedNodes).toHaveLength(0)
    })

    it('toggleSelectedNodesMode should toggle node modes correctly', () => {
      const { toggleSelectedNodesMode } = useSelectedLiteGraphItems()
      const node1 = { id: 1, mode: LGraphEventMode.ALWAYS } as LGraphNode
      const node2 = { id: 2, mode: LGraphEventMode.NEVER } as LGraphNode

      app.canvas.selected_nodes = { '0': node1, '1': node2 }

      // Toggle to NEVER mode
      toggleSelectedNodesMode(LGraphEventMode.NEVER)

      // node1 should change from ALWAYS to NEVER
      // node2 should change from NEVER to ALWAYS (since it was already NEVER)
      expect(node1.mode).toBe(LGraphEventMode.NEVER)
      expect(node2.mode).toBe(LGraphEventMode.ALWAYS)
    })

    it('toggleSelectedNodesMode should set mode to ALWAYS when already in target mode', () => {
      const { toggleSelectedNodesMode } = useSelectedLiteGraphItems()
      const node = { id: 1, mode: LGraphEventMode.BYPASS } as LGraphNode

      app.canvas.selected_nodes = { '0': node }

      // Toggle to BYPASS mode (node is already BYPASS)
      toggleSelectedNodesMode(LGraphEventMode.BYPASS)

      // Should change to ALWAYS
      expect(node.mode).toBe(LGraphEventMode.ALWAYS)
    })

    it('getSelectedNodes should include nodes from subgraphs', () => {
      const { getSelectedNodes } = useSelectedLiteGraphItems()
      const subNode1 = { id: 11, mode: LGraphEventMode.ALWAYS } as LGraphNode
      const subNode2 = { id: 12, mode: LGraphEventMode.NEVER } as LGraphNode
      const subgraphNode = {
        id: 1,
        mode: LGraphEventMode.ALWAYS,
        isSubgraphNode: () => true,
        subgraph: {
          nodes: [subNode1, subNode2]
        }
      } as unknown as LGraphNode
      const regularNode = { id: 2, mode: LGraphEventMode.NEVER } as LGraphNode

      app.canvas.selected_nodes = { '0': subgraphNode, '1': regularNode }

      const selectedNodes = getSelectedNodes()
      expect(selectedNodes).toHaveLength(4) // subgraphNode + 2 sub nodes + regularNode
      expect(selectedNodes).toContainEqual(subgraphNode)
      expect(selectedNodes).toContainEqual(regularNode)
      expect(selectedNodes).toContainEqual(subNode1)
      expect(selectedNodes).toContainEqual(subNode2)
    })

    it('toggleSelectedNodesMode should apply unified state to subgraph children', () => {
      const { toggleSelectedNodesMode } = useSelectedLiteGraphItems()
      const subNode1 = { id: 11, mode: LGraphEventMode.ALWAYS } as LGraphNode
      const subNode2 = { id: 12, mode: LGraphEventMode.NEVER } as LGraphNode
      const subgraphNode = {
        id: 1,
        mode: LGraphEventMode.ALWAYS,
        isSubgraphNode: () => true,
        subgraph: {
          nodes: [subNode1, subNode2]
        }
      } as unknown as LGraphNode
      const regularNode = { id: 2, mode: LGraphEventMode.BYPASS } as LGraphNode

      app.canvas.selected_nodes = { '0': subgraphNode, '1': regularNode }

      // Toggle to NEVER mode
      toggleSelectedNodesMode(LGraphEventMode.NEVER)

      // Selected nodes follow standard toggle logic:
      // subgraphNode: ALWAYS -> NEVER (since ALWAYS != NEVER)
      expect(subgraphNode.mode).toBe(LGraphEventMode.NEVER)
      // regularNode: BYPASS -> NEVER (since BYPASS != NEVER)
      expect(regularNode.mode).toBe(LGraphEventMode.NEVER)

      // Subgraph children get unified state (same as their parent):
      // Both children should now be NEVER, regardless of their previous states
      expect(subNode1.mode).toBe(LGraphEventMode.NEVER) // was ALWAYS, now NEVER
      expect(subNode2.mode).toBe(LGraphEventMode.NEVER) // was NEVER, stays NEVER
    })

    it('toggleSelectedNodesMode should toggle to ALWAYS when subgraph is already in target mode', () => {
      const { toggleSelectedNodesMode } = useSelectedLiteGraphItems()
      const subNode1 = { id: 11, mode: LGraphEventMode.ALWAYS } as LGraphNode
      const subNode2 = { id: 12, mode: LGraphEventMode.BYPASS } as LGraphNode
      const subgraphNode = {
        id: 1,
        mode: LGraphEventMode.NEVER, // Already in NEVER mode
        isSubgraphNode: () => true,
        subgraph: {
          nodes: [subNode1, subNode2]
        }
      } as unknown as LGraphNode

      app.canvas.selected_nodes = { '0': subgraphNode }

      // Toggle to NEVER mode (but subgraphNode is already NEVER)
      toggleSelectedNodesMode(LGraphEventMode.NEVER)

      // Selected subgraph should toggle to ALWAYS (since it was already NEVER)
      expect(subgraphNode.mode).toBe(LGraphEventMode.ALWAYS)

      // All children should also get ALWAYS (unified with parent's new state)
      expect(subNode1.mode).toBe(LGraphEventMode.ALWAYS)
      expect(subNode2.mode).toBe(LGraphEventMode.ALWAYS)
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
