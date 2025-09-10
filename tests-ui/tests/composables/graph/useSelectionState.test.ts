import { beforeEach, describe, expect, test, vi } from 'vitest'
import { nextTick } from 'vue'

import { useSelectionState } from '@/composables/graph/useSelectionState'
import { useNodeLibrarySidebarTab } from '@/composables/sidebarTabs/useNodeLibrarySidebarTab'
import { LGraphEventMode } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/stores/graphStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useNodeHelpStore } from '@/stores/workspace/nodeHelpStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
import { isImageNode, isLGraphNode } from '@/utils/litegraphUtil'
import { filterOutputNodes } from '@/utils/nodeFilterUtil'

// Test interfaces
interface TestNodeConfig {
  type?: string
  mode?: LGraphEventMode
  flags?: { collapsed?: boolean }
  pinned?: boolean
  removable?: boolean
}

interface TestNode {
  type: string
  mode: LGraphEventMode
  flags?: { collapsed?: boolean }
  pinned?: boolean
  removable?: boolean
  isSubgraphNode: () => boolean
}

// Mock all stores
vi.mock('@/stores/graphStore', () => ({
  useCanvasStore: vi.fn()
}))

vi.mock('@/stores/nodeDefStore', () => ({
  useNodeDefStore: vi.fn()
}))

vi.mock('@/stores/workspace/sidebarTabStore', () => ({
  useSidebarTabStore: vi.fn()
}))

vi.mock('@/stores/workspace/nodeHelpStore', () => ({
  useNodeHelpStore: vi.fn()
}))

vi.mock('@/composables/sidebarTabs/useNodeLibrarySidebarTab', () => ({
  useNodeLibrarySidebarTab: vi.fn()
}))

vi.mock('@/utils/litegraphUtil', () => ({
  isLGraphNode: vi.fn(),
  isImageNode: vi.fn()
}))

vi.mock('@/utils/nodeFilterUtil', () => ({
  filterOutputNodes: vi.fn()
}))

const createTestNode = (config: TestNodeConfig = {}): TestNode => {
  return {
    type: config.type || 'TestNode',
    mode: config.mode || LGraphEventMode.ALWAYS,
    flags: config.flags,
    pinned: config.pinned,
    removable: config.removable,
    isSubgraphNode: () => false
  }
}

const createTestSubgraphNode = (config: TestNodeConfig = {}): TestNode => {
  return {
    type: 'SubgraphNode',
    mode: config.mode || LGraphEventMode.ALWAYS,
    flags: config.flags,
    pinned: config.pinned,
    removable: config.removable,
    isSubgraphNode: () => true
  }
}

// Mock comment/connection objects
const mockComment = { type: 'comment', isNode: false }
const mockConnection = { type: 'connection', isNode: false }

describe('useSelectionState', () => {
  // Mock store instances
  let mockCanvasStore: {
    selectedItems: Array<TestNode | { type: string; isNode: boolean }>
  }
  let mockNodeDefStore: { fromLGraphNode: ReturnType<typeof vi.fn> }
  let mockSidebarTabStore: {
    activeSidebarTabId: string | null
    toggleSidebarTab: ReturnType<typeof vi.fn>
  }
  let mockNodeHelpStore: {
    isHelpOpen: boolean
    currentHelpNode: { nodePath: string } | null
    openHelp: ReturnType<typeof vi.fn>
    closeHelp: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup mock canvas store
    mockCanvasStore = {
      selectedItems: []
    }
    vi.mocked(useCanvasStore).mockReturnValue(
      mockCanvasStore as unknown as ReturnType<typeof useCanvasStore>
    )

    // Setup mock node def store
    mockNodeDefStore = {
      fromLGraphNode: vi.fn((node: TestNode) => {
        if (node?.type === 'TestNode') {
          return { nodePath: 'test.TestNode', name: 'TestNode' }
        }
        return null
      })
    }
    vi.mocked(useNodeDefStore).mockReturnValue(
      mockNodeDefStore as unknown as ReturnType<typeof useNodeDefStore>
    )

    // Setup mock sidebar tab store
    mockSidebarTabStore = {
      activeSidebarTabId: null,
      toggleSidebarTab: vi.fn()
    }
    vi.mocked(useSidebarTabStore).mockReturnValue(
      mockSidebarTabStore as unknown as ReturnType<typeof useSidebarTabStore>
    )

    // Setup mock node help store
    mockNodeHelpStore = {
      isHelpOpen: false,
      currentHelpNode: null,
      openHelp: vi.fn(),
      closeHelp: vi.fn()
    }
    vi.mocked(useNodeHelpStore).mockReturnValue(
      mockNodeHelpStore as unknown as ReturnType<typeof useNodeHelpStore>
    )

    // Setup mock composables
    vi.mocked(useNodeLibrarySidebarTab).mockReturnValue({
      id: 'node-library-tab',
      title: 'Node Library',
      type: 'custom',
      render: () => null
    } as unknown as ReturnType<typeof useNodeLibrarySidebarTab>)

    // Setup mock utility functions
    vi.mocked(isLGraphNode).mockImplementation((item: unknown) => {
      const typedItem = item as { isNode?: boolean }
      return typedItem?.isNode !== false
    })
    vi.mocked(isImageNode).mockImplementation((node: unknown) => {
      const typedNode = node as { type?: string }
      return typedNode?.type === 'ImageNode'
    })
    vi.mocked(filterOutputNodes).mockImplementation(
      (nodes: unknown[]) =>
        (nodes as TestNode[]).filter(
          (n) => n.type === 'OutputNode'
        ) as unknown as ReturnType<typeof filterOutputNodes>
    )
  })

  describe('Selection Detection', () => {
    test('should return false when nothing selected', () => {
      const { hasAnySelection } = useSelectionState()
      expect(hasAnySelection.value).toBe(false)
    })

    test('should return true when items selected', () => {
      const node1 = createTestNode()
      const node2 = createTestNode()
      mockCanvasStore.selectedItems = [node1, node2]

      const { hasAnySelection } = useSelectionState()
      expect(hasAnySelection.value).toBe(true)
    })

    test('should distinguish single vs multiple selections', () => {
      const node = createTestNode()
      mockCanvasStore.selectedItems = [node]

      const { hasSingleSelection, hasMultipleSelection } = useSelectionState()
      expect(hasSingleSelection.value).toBe(true)
      expect(hasMultipleSelection.value).toBe(false)

      // Test multiple selection with new instance
      mockCanvasStore.selectedItems = [node, createTestNode()]
      const multipleState = useSelectionState()
      expect(multipleState.hasSingleSelection.value).toBe(false)
      expect(multipleState.hasMultipleSelection.value).toBe(true)
    })
  })

  describe('Node Type Filtering', () => {
    test('should pick only LGraphNodes from mixed selections', () => {
      const graphNode = createTestNode()
      mockCanvasStore.selectedItems = [graphNode, mockComment, mockConnection]

      const { selectedNodes } = useSelectionState()
      expect(selectedNodes.value).toHaveLength(1)
      expect(selectedNodes.value[0]).toEqual(graphNode)
    })

    test('should detect subgraphs in selection', () => {
      const subgraph = createTestSubgraphNode()
      mockCanvasStore.selectedItems = [subgraph]

      const { hasSubgraphs, isSingleSubgraph } = useSelectionState()
      expect(hasSubgraphs.value).toBe(true)
      expect(isSingleSubgraph.value).toBe(true)
    })
  })

  describe('Node State Computation', () => {
    test('should detect bypassed nodes', () => {
      const bypassedNode = createTestNode({ mode: LGraphEventMode.BYPASS })
      mockCanvasStore.selectedItems = [bypassedNode]

      const { selectedNodesStates } = useSelectionState()
      expect(selectedNodesStates.value.bypassed).toBe(true)
    })

    test('should detect pinned/collapsed states', () => {
      const pinnedNode = createTestNode({ pinned: true })
      const collapsedNode = createTestNode({ flags: { collapsed: true } })
      mockCanvasStore.selectedItems = [pinnedNode, collapsedNode]

      const { selectedNodesStates } = useSelectionState()
      expect(selectedNodesStates.value.pinned).toBe(true)
      expect(selectedNodesStates.value.collapsed).toBe(true)
      expect(selectedNodesStates.value.bypassed).toBe(false)
    })

    test('should provide non-reactive state computation', () => {
      const node = createTestNode({ pinned: true })
      mockCanvasStore.selectedItems = [node]

      const { computeSelectionFlags } = useSelectionState()
      const flags = computeSelectionFlags()

      expect(flags.pinned).toBe(true)
      expect(flags.collapsed).toBe(false)
      expect(flags.bypassed).toBe(false)

      // Test with empty selection using new composable instance
      mockCanvasStore.selectedItems = []
      const { computeSelectionFlags: newComputeFlags } = useSelectionState()
      const newFlags = newComputeFlags()
      expect(newFlags.pinned).toBe(false)
    })
  })

  describe('Data Integrity', () => {
    test('should handle missing removable property', () => {
      const node = createTestNode()
      delete node.removable
      mockCanvasStore.selectedItems = [node]

      const { selectedItems } = useSelectionState()
      expect(selectedItems.value[0].removable).toBeUndefined()
    })

    test('should return default states for empty selection', () => {
      const { selectedNodesStates } = useSelectionState()
      expect(selectedNodesStates.value).toEqual({
        collapsed: false,
        pinned: false,
        bypassed: false
      })
    })
  })

  describe('Help Integration', () => {
    test('should show help for single node', async () => {
      const node = createTestNode({ type: 'TestNode' })
      mockCanvasStore.selectedItems = [node]

      const { showNodeHelp } = useSelectionState()
      showNodeHelp()
      await nextTick()

      expect(mockSidebarTabStore.toggleSidebarTab).toHaveBeenCalledWith(
        'node-library-tab'
      )
      expect(mockNodeHelpStore.openHelp).toHaveBeenCalledWith({
        nodePath: 'test.TestNode',
        name: 'TestNode'
      })
    })

    test('should ignore help request for multiple nodes', () => {
      const node1 = createTestNode()
      const node2 = createTestNode()
      mockCanvasStore.selectedItems = [node1, node2]

      const { showNodeHelp } = useSelectionState()
      showNodeHelp()

      expect(mockSidebarTabStore.toggleSidebarTab).not.toHaveBeenCalled()
      expect(mockNodeHelpStore.openHelp).not.toHaveBeenCalled()
    })

    test('should toggle help when same node help is already open', async () => {
      const node = createTestNode({ type: 'TestNode' })
      mockCanvasStore.selectedItems = [node]
      mockSidebarTabStore.activeSidebarTabId = 'node-library-tab'
      mockNodeHelpStore.isHelpOpen = true
      mockNodeHelpStore.currentHelpNode = { nodePath: 'test.TestNode' }

      const { showNodeHelp } = useSelectionState()
      showNodeHelp()
      await nextTick()

      expect(mockNodeHelpStore.closeHelp).toHaveBeenCalled()
      expect(mockSidebarTabStore.toggleSidebarTab).toHaveBeenCalledWith(
        'node-library-tab'
      )
    })
  })

  describe('Button Pattern Consistency', () => {
    test('should provide consistent state for all buttons', () => {
      const node = createTestNode({
        mode: LGraphEventMode.BYPASS,
        pinned: true
      })
      mockCanvasStore.selectedItems = [node]

      const state1 = useSelectionState()
      const state2 = useSelectionState()

      expect(state1.selectedNodesStates.value.bypassed).toBe(true)
      expect(state2.selectedNodesStates.value.bypassed).toBe(true)
      expect(state1.selectedNodesStates.value.pinned).toBe(true)
      expect(state2.selectedNodesStates.value.pinned).toBe(true)

      // Test with empty selection using new instances
      mockCanvasStore.selectedItems = []
      const emptyState1 = useSelectionState()
      const emptyState2 = useSelectionState()

      expect(emptyState1.hasAnySelection.value).toBe(false)
      expect(emptyState2.hasAnySelection.value).toBe(false)
    })

    test('should support standardized deletability check', () => {
      const deletableNode = createTestNode({ removable: true })
      const nonDeletableNode = createTestNode({ removable: false })

      mockCanvasStore.selectedItems = [deletableNode]
      const { selectedItems: items1 } = useSelectionState()

      const isDeletable1 = items1.value.every(
        (item) => item.removable !== false
      )
      expect(isDeletable1).toBe(true)

      mockCanvasStore.selectedItems = [nonDeletableNode]
      const { selectedItems: items2 } = useSelectionState()
      const isDeletable2 = items2.value.every(
        (item) => item.removable !== false
      )
      expect(isDeletable2).toBe(false)

      mockCanvasStore.selectedItems = [deletableNode, nonDeletableNode]
      const { selectedItems: items3 } = useSelectionState()
      const isDeletable3 = items3.value.every(
        (item) => item.removable !== false
      )
      expect(isDeletable3).toBe(false)
    })
  })

  describe('Special Node Types', () => {
    test('should detect image nodes', () => {
      const imageNode = createTestNode({ type: 'ImageNode' })
      mockCanvasStore.selectedItems = [imageNode]

      const { isSingleImageNode, hasImageNode } = useSelectionState()
      expect(isSingleImageNode.value).toBe(true)
      expect(hasImageNode.value).toBe(true)
    })

    test('should detect output nodes', () => {
      const outputNode = createTestNode({ type: 'OutputNode' })
      mockCanvasStore.selectedItems = [outputNode]

      const { hasOutputNodesSelected } = useSelectionState()
      expect(hasOutputNodesSelected.value).toBe(true)
    })

    test('should return correct nodeDef for single node', () => {
      const node = createTestNode({ type: 'TestNode' })
      mockCanvasStore.selectedItems = [node]

      const { nodeDef } = useSelectionState()
      expect(nodeDef.value).toEqual({
        nodePath: 'test.TestNode',
        name: 'TestNode'
      })
    })

    test('should return null nodeDef for multiple nodes', () => {
      const node1 = createTestNode()
      const node2 = createTestNode()
      mockCanvasStore.selectedItems = [node1, node2]

      const { nodeDef } = useSelectionState()
      expect(nodeDef.value).toBeNull()
    })
  })
})
