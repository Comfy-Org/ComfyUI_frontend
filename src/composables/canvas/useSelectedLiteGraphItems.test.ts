import { createPinia, setActivePinia } from 'pinia'
import { markRaw } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSelectedLiteGraphItems } from '@/composables/canvas/useSelectedLiteGraphItems'
import type { Positionable } from '@/lib/litegraph/src/litegraph'
import {
  LGraphEventMode,
  LGraphNode,
  Reroute,
  asNodeId
} from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import type { NodeId } from '@/renderer/core/layout/types'
import type { ReadOnlyRect } from '@/lib/litegraph/src/interfaces'

const mockApp = vi.hoisted(() => ({
  canvas: {
    selected_nodes: null as Record<string, LGraphNode> | null
  }
}))

// canvasStore transitively imports the app singleton; stub it so the real
// ComfyApp module never loads during these unit tests.
vi.mock('@/scripts/app', () => ({ app: mockApp }))

// Mock the litegraph module
vi.mock('@/lib/litegraph/src/litegraph', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    Reroute: class Reroute {
      constructor() {}
    }
  }
})

// Real LGraphNode instances so the production isLGraphNode (instanceof) guard runs
// unmodified — the node accessors filter selectedItems with the real predicate.
const makeNode = (mode: LGraphEventMode, id = 1): LGraphNode => {
  const node = new LGraphNode('Test')
  node.id = asNodeId(id)
  node.mode = mode
  return node
}

const makeSubgraphNode = (
  children: LGraphNode[],
  overrides: { id?: number; mode?: LGraphEventMode } = {}
): LGraphNode =>
  Object.assign(
    makeNode(overrides.mode ?? LGraphEventMode.ALWAYS, overrides.id ?? 1),
    {
      isSubgraphNode: () => true,
      subgraph: { nodes: children }
    }
  )

// Mock Positionable objects

class MockNode implements Positionable {
  pos: [number, number]
  size: [number, number]
  id: NodeId
  boundingRect: ReadOnlyRect

  constructor(
    pos: [number, number] = [0, 0],
    size: [number, number] = [100, 100]
  ) {
    this.pos = pos
    this.size = size
    this.id = asNodeId('mock-node')
    this.boundingRect = [0, 0, 0, 0]
  }

  move(): void {}
  snapToGrid(_: number): boolean {
    return true
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
  let mockCanvas: { selectedItems: Set<Positionable> }

  beforeEach(() => {
    setActivePinia(createPinia())
    canvasStore = useCanvasStore()
    mockApp.canvas.selected_nodes = null

    // markRaw so the spied getter's return is not reactive-wrapped by the Pinia
    // store proxy — production reads a shallowRef, so nodes stay raw references.
    mockCanvas = markRaw({
      selectedItems: new Set<Positionable>()
    })

    // getSelectableItems reads getCanvas(); the node accessors read canvasStore.canvas.
    // Point both at the same mock canvas.
    vi.spyOn(canvasStore, 'getCanvas').mockReturnValue(
      mockCanvas as ReturnType<typeof canvasStore.getCanvas>
    )
    vi.spyOn(canvasStore, 'canvas', 'get').mockReturnValue(
      mockCanvas as ReturnType<typeof canvasStore.getCanvas>
    )
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
      expect(isIgnoredItem(node)).toBe(false)
    })
  })

  describe('filterSelectableItems', () => {
    it('should filter out Reroute items', () => {
      const { filterSelectableItems } = useSelectedLiteGraphItems()
      const node1 = new MockNode([0, 0])
      const node2 = new MockNode([100, 100])
      const reroute = new MockReroute([50, 50])

      const items = new Set<Positionable>([node1, node2, reroute])
      const filtered = filterSelectableItems(items)

      expect(filtered.size).toBe(2)
      expect(filtered.has(node1)).toBe(true)
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
      expect(selectableItems.has(node1)).toBe(true)
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
      const node1 = makeNode(LGraphEventMode.ALWAYS, 1)
      const node2 = makeNode(LGraphEventMode.NEVER, 2)
      const reroute = new MockReroute()

      // The non-node (reroute) must be filtered out by isLGraphNode.
      mockCanvas.selectedItems = new Set([node1, reroute, node2])

      const selectedNodes = getSelectedNodes()
      expect(selectedNodes).toHaveLength(2)
      expect(selectedNodes[0]).toBe(node1)
      expect(selectedNodes[1]).toBe(node2)
      expect(selectedNodes).not.toContain(reroute)
    })

    it('getSelectedNodes should return empty array when no nodes selected', () => {
      const { getSelectedNodes } = useSelectedLiteGraphItems()

      mockCanvas.selectedItems = new Set()

      const selectedNodes = getSelectedNodes()
      expect(selectedNodes).toHaveLength(0)
    })

    it('toggleSelectedNodesMode should toggle node modes correctly', () => {
      const { toggleSelectedNodesMode } = useSelectedLiteGraphItems()
      const node1 = makeNode(LGraphEventMode.ALWAYS, 1)
      const node2 = makeNode(LGraphEventMode.NEVER, 2)

      mockCanvas.selectedItems = new Set([node1, node2])

      // Toggle to NEVER mode
      toggleSelectedNodesMode(LGraphEventMode.NEVER)

      // node1 should change from ALWAYS to NEVER
      // node2 should stay NEVER (since a selected node exists which is not NEVER)
      expect(node1.mode).toBe(LGraphEventMode.NEVER)
      expect(node2.mode).toBe(LGraphEventMode.NEVER)
    })

    it('toggleSelectedNodesMode should set mode to ALWAYS when already in target mode', () => {
      const { toggleSelectedNodesMode } = useSelectedLiteGraphItems()
      const node = makeNode(LGraphEventMode.BYPASS, 1)

      mockCanvas.selectedItems = new Set([node])

      // Toggle to BYPASS mode (node is already BYPASS)
      toggleSelectedNodesMode(LGraphEventMode.BYPASS)

      // Should change to ALWAYS
      expect(node.mode).toBe(LGraphEventMode.ALWAYS)
    })

    it('areAllSelectedNodesInMode returns true when every selected node matches', () => {
      const { areAllSelectedNodesInMode } = useSelectedLiteGraphItems()
      const node1 = makeNode(LGraphEventMode.BYPASS, 1)
      const node2 = makeNode(LGraphEventMode.BYPASS, 2)

      mockCanvas.selectedItems = new Set([node1, node2])

      expect(areAllSelectedNodesInMode(LGraphEventMode.BYPASS)).toBe(true)
    })

    it('areAllSelectedNodesInMode returns false on mixed selection', () => {
      const { areAllSelectedNodesInMode } = useSelectedLiteGraphItems()
      const bypassed = makeNode(LGraphEventMode.BYPASS, 1)
      const active = makeNode(LGraphEventMode.ALWAYS, 2)

      mockCanvas.selectedItems = new Set([bypassed, active])

      expect(areAllSelectedNodesInMode(LGraphEventMode.BYPASS)).toBe(false)
    })

    it('areAllSelectedNodesInMode returns false for empty selection', () => {
      const { areAllSelectedNodesInMode } = useSelectedLiteGraphItems()

      mockCanvas.selectedItems = new Set()

      expect(areAllSelectedNodesInMode(LGraphEventMode.BYPASS)).toBe(false)
    })

    it('getSelectedNodes should include nodes from subgraphs', () => {
      const { getSelectedNodes } = useSelectedLiteGraphItems()
      const subNode1 = makeNode(LGraphEventMode.ALWAYS, 11)
      const subNode2 = makeNode(LGraphEventMode.NEVER, 12)
      const subgraphNode = makeSubgraphNode([subNode1, subNode2])
      const regularNode = makeNode(LGraphEventMode.NEVER, 2)

      mockCanvas.selectedItems = new Set([subgraphNode, regularNode])

      const selectedNodes = getSelectedNodes()
      expect(selectedNodes).toHaveLength(4) // subgraphNode + 2 sub nodes + regularNode
      expect(selectedNodes).toContain(subgraphNode)
      expect(selectedNodes).toContain(regularNode)
      expect(selectedNodes).toContain(subNode1)
      expect(selectedNodes).toContain(subNode2)
    })

    it('toggleSelectedNodesMode should not apply state to subgraph children', () => {
      const { toggleSelectedNodesMode } = useSelectedLiteGraphItems()
      const subNode1 = makeNode(LGraphEventMode.ALWAYS, 11)
      const subNode2 = makeNode(LGraphEventMode.NEVER, 12)
      const subgraphNode = makeSubgraphNode([subNode1, subNode2])
      const regularNode = makeNode(LGraphEventMode.BYPASS, 2)

      mockCanvas.selectedItems = new Set([subgraphNode, regularNode])

      // Toggle to NEVER mode
      toggleSelectedNodesMode(LGraphEventMode.NEVER)

      // Selected nodes follow standard toggle logic:
      // subgraphNode: ALWAYS -> NEVER (since ALWAYS != NEVER)
      expect(subgraphNode.mode).toBe(LGraphEventMode.NEVER)
      // regularNode: BYPASS -> NEVER (since BYPASS != NEVER)
      expect(regularNode.mode).toBe(LGraphEventMode.NEVER)

      // Subgraph children do not change state
      expect(subNode1.mode).toBe(LGraphEventMode.ALWAYS) // was ALWAYS, stays ALWAYS
      expect(subNode2.mode).toBe(LGraphEventMode.NEVER) // was NEVER, stays NEVER
    })

    it('toggleSelectedNodesMode should toggle to ALWAYS when subgraph is already in target mode', () => {
      const { toggleSelectedNodesMode } = useSelectedLiteGraphItems()
      const subNode1 = makeNode(LGraphEventMode.ALWAYS, 11)
      const subNode2 = makeNode(LGraphEventMode.BYPASS, 12)
      const subgraphNode = makeSubgraphNode([subNode1, subNode2], {
        id: 1,
        mode: LGraphEventMode.NEVER // Already in NEVER mode
      })

      mockCanvas.selectedItems = new Set([subgraphNode])

      // Toggle to NEVER mode (but subgraphNode is already NEVER)
      toggleSelectedNodesMode(LGraphEventMode.NEVER)

      // Selected subgraph should toggle to ALWAYS (since it was already NEVER)
      expect(subgraphNode.mode).toBe(LGraphEventMode.ALWAYS)

      // All children should be unchanged
      expect(subNode1.mode).toBe(LGraphEventMode.ALWAYS)
      expect(subNode2.mode).toBe(LGraphEventMode.BYPASS)
    })

    it('reads only the canonical selectedItems set, ignoring the legacy dict', () => {
      const { getSelectedNodes, areAllSelectedNodesInMode } =
        useSelectedLiteGraphItems()
      const selected = makeNode(LGraphEventMode.BYPASS, 1)
      const legacyOnly = makeNode(LGraphEventMode.ALWAYS, 99)

      mockCanvas.selectedItems = new Set([selected])
      // A different node lives only in the legacy dict; it must be ignored.
      mockApp.canvas.selected_nodes = { '0': legacyOnly }

      const selectedNodes = getSelectedNodes()
      expect(selectedNodes).toHaveLength(1)
      expect(selectedNodes).toContain(selected)
      expect(selectedNodes).not.toContain(legacyOnly)
      expect(areAllSelectedNodesInMode(LGraphEventMode.BYPASS)).toBe(true)
    })

    it('returns empty without throwing when the canvas is unavailable', () => {
      vi.spyOn(canvasStore, 'canvas', 'get').mockReturnValue(null)
      const { getSelectedNodes, areAllSelectedNodesInMode } =
        useSelectedLiteGraphItems()

      expect(getSelectedNodes()).toEqual([])
      expect(areAllSelectedNodesInMode(LGraphEventMode.BYPASS)).toBe(false)
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
