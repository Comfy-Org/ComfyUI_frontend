import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { type Ref, nextTick, ref } from 'vue'

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

type MockedItem = TestNode | { type: string; isNode: boolean }

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
  let mockSelectedItems: Ref<MockedItem[]>

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())

    // Setup mock canvas store with proper ref
    mockSelectedItems = ref([])
    vi.mocked(useCanvasStore).mockReturnValue({
      selectedItems: mockSelectedItems,
      // Add minimal required properties for the store
      $id: 'canvas',
      $state: {} as any,
      $patch: vi.fn(),
      $reset: vi.fn(),
      $subscribe: vi.fn(),
      $onAction: vi.fn(),
      $dispose: vi.fn(),
      _customProperties: new Set(),
      _p: {} as any
    } as any)

    // Setup mock node def store
    vi.mocked(useNodeDefStore).mockReturnValue({
      fromLGraphNode: vi.fn((node: TestNode) => {
        if (node?.type === 'TestNode') {
          return { nodePath: 'test.TestNode', name: 'TestNode' }
        }
        return null
      }),
      // Add minimal required properties for the store
      $id: 'nodeDef',
      $state: {} as any,
      $patch: vi.fn(),
      $reset: vi.fn(),
      $subscribe: vi.fn(),
      $onAction: vi.fn(),
      $dispose: vi.fn(),
      _customProperties: new Set(),
      _p: {} as any
    } as any)

    // Setup mock sidebar tab store
    const mockToggleSidebarTab = vi.fn()
    vi.mocked(useSidebarTabStore).mockReturnValue({
      activeSidebarTabId: null,
      toggleSidebarTab: mockToggleSidebarTab,
      // Add minimal required properties for the store
      $id: 'sidebarTab',
      $state: {} as any,
      $patch: vi.fn(),
      $reset: vi.fn(),
      $subscribe: vi.fn(),
      $onAction: vi.fn(),
      $dispose: vi.fn(),
      _customProperties: new Set(),
      _p: {} as any
    } as any)

    // Setup mock node help store
    const mockOpenHelp = vi.fn()
    const mockCloseHelp = vi.fn()
    const mockNodeHelpStore = {
      isHelpOpen: false,
      currentHelpNode: null,
      openHelp: mockOpenHelp,
      closeHelp: mockCloseHelp,
      // Add minimal required properties for the store
      $id: 'nodeHelp',
      $state: {} as any,
      $patch: vi.fn(),
      $reset: vi.fn(),
      $subscribe: vi.fn(),
      $onAction: vi.fn(),
      $dispose: vi.fn(),
      _customProperties: new Set(),
      _p: {} as any
    }
    vi.mocked(useNodeHelpStore).mockReturnValue(mockNodeHelpStore as any)

    // Setup mock composables
    vi.mocked(useNodeLibrarySidebarTab).mockReturnValue({
      id: 'node-library-tab',
      title: 'Node Library',
      type: 'custom',
      render: () => null
    } as any)

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
      (nodes: TestNode[]) => nodes.filter((n) => n.type === 'OutputNode') as any
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
      mockSelectedItems.value = [node1, node2]

      const { hasAnySelection } = useSelectionState()
      expect(hasAnySelection.value).toBe(true)
    })

    test('should distinguish single vs multiple selections', () => {
      const node = createTestNode()
      mockSelectedItems.value = [node]

      const { hasSingleSelection, hasMultipleSelection } = useSelectionState()
      expect(hasSingleSelection.value).toBe(true)
      expect(hasMultipleSelection.value).toBe(false)

      // Test multiple selection with new instance
      mockSelectedItems.value = [node, createTestNode()]
      const multipleState = useSelectionState()
      expect(multipleState.hasSingleSelection.value).toBe(false)
      expect(multipleState.hasMultipleSelection.value).toBe(true)
    })
  })

  describe('Node Type Filtering', () => {
    test('should pick only LGraphNodes from mixed selections', () => {
      const graphNode = createTestNode()
      mockSelectedItems.value = [graphNode, mockComment, mockConnection]

      const { selectedNodes } = useSelectionState()
      expect(selectedNodes.value).toHaveLength(1)
      expect(selectedNodes.value[0]).toEqual(graphNode)
    })

    test('should detect subgraphs in selection', () => {
      const subgraph = createTestSubgraphNode()
      mockSelectedItems.value = [subgraph]

      const { hasSubgraphs, isSingleSubgraph } = useSelectionState()
      expect(hasSubgraphs.value).toBe(true)
      expect(isSingleSubgraph.value).toBe(true)
    })
  })

  describe('Node State Computation', () => {
    test('should detect bypassed nodes', () => {
      const bypassedNode = createTestNode({ mode: LGraphEventMode.BYPASS })
      mockSelectedItems.value = [bypassedNode]

      const { selectedNodes } = useSelectionState()
      const isBypassed = selectedNodes.value.some(
        (n) => n.mode === LGraphEventMode.BYPASS
      )
      expect(isBypassed).toBe(true)
    })

    test('should detect pinned/collapsed states', () => {
      const pinnedNode = createTestNode({ pinned: true })
      const collapsedNode = createTestNode({ flags: { collapsed: true } })
      mockSelectedItems.value = [pinnedNode, collapsedNode]

      const { selectedNodes } = useSelectionState()
      const isPinned = selectedNodes.value.some((n) => n.pinned === true)
      const isCollapsed = selectedNodes.value.some(
        (n) => n.flags?.collapsed === true
      )
      const isBypassed = selectedNodes.value.some(
        (n) => n.mode === LGraphEventMode.BYPASS
      )
      expect(isPinned).toBe(true)
      expect(isCollapsed).toBe(true)
      expect(isBypassed).toBe(false)
    })

    test('should provide non-reactive state computation', () => {
      const node = createTestNode({ pinned: true })
      mockSelectedItems.value = [node]

      const { selectedNodes } = useSelectionState()
      const isPinned = selectedNodes.value.some((n) => n.pinned === true)
      const isCollapsed = selectedNodes.value.some(
        (n) => n.flags?.collapsed === true
      )
      const isBypassed = selectedNodes.value.some(
        (n) => n.mode === LGraphEventMode.BYPASS
      )

      expect(isPinned).toBe(true)
      expect(isCollapsed).toBe(false)
      expect(isBypassed).toBe(false)

      // Test with empty selection using new composable instance
      mockSelectedItems.value = []
      const { selectedNodes: newSelectedNodes } = useSelectionState()
      const newIsPinned = newSelectedNodes.value.some((n) => n.pinned === true)
      expect(newIsPinned).toBe(false)
    })
  })

  describe('Data Integrity', () => {
    test('should handle missing removable property', () => {
      const node = createTestNode()
      delete node.removable
      mockSelectedItems.value = [node]

      const { selectedItems } = useSelectionState()
      expect(selectedItems.value[0].removable).toBeUndefined()
    })

    test('should return default states for empty selection', () => {
      const { selectedNodes } = useSelectionState()
      const isPinned = selectedNodes.value.some((n) => n.pinned === true)
      const isCollapsed = selectedNodes.value.some(
        (n) => n.flags?.collapsed === true
      )
      const isBypassed = selectedNodes.value.some(
        (n) => n.mode === LGraphEventMode.BYPASS
      )
      expect(isPinned).toBe(false)
      expect(isCollapsed).toBe(false)
      expect(isBypassed).toBe(false)
    })
  })

  describe('Help Integration', () => {
    test('should show help for single node', async () => {
      const node = createTestNode({ type: 'TestNode' })
      mockSelectedItems.value = [node]

      const { showNodeHelp } = useSelectionState()
      const sidebarStore = useSidebarTabStore()
      const nodeHelpStore = useNodeHelpStore()

      showNodeHelp()
      await nextTick()

      expect(sidebarStore.toggleSidebarTab).toHaveBeenCalledWith(
        'node-library-tab'
      )
      expect(nodeHelpStore.openHelp).toHaveBeenCalledWith({
        nodePath: 'test.TestNode',
        name: 'TestNode'
      })
    })

    test('should ignore help request for multiple nodes', () => {
      const node1 = createTestNode()
      const node2 = createTestNode()
      mockSelectedItems.value = [node1, node2]

      const { showNodeHelp } = useSelectionState()
      const sidebarStore = useSidebarTabStore()
      const nodeHelpStore = useNodeHelpStore()

      showNodeHelp()

      expect(sidebarStore.toggleSidebarTab).not.toHaveBeenCalled()
      expect(nodeHelpStore.openHelp).not.toHaveBeenCalled()
    })

    test('should toggle help when same node help is already open', async () => {
      const node = createTestNode({ type: 'TestNode' })
      mockSelectedItems.value = [node]

      // Update the mock stores to have the right state
      const sidebarStore = useSidebarTabStore()
      const nodeHelpStore = useNodeHelpStore()

      vi.mocked(useSidebarTabStore).mockReturnValue({
        ...sidebarStore,
        activeSidebarTabId: 'node-library-tab'
      } as any)

      vi.mocked(useNodeHelpStore).mockReturnValue({
        ...nodeHelpStore,
        isHelpOpen: true,
        currentHelpNode: { nodePath: 'test.TestNode' }
      } as any)

      const { showNodeHelp } = useSelectionState()
      showNodeHelp()
      await nextTick()

      expect(nodeHelpStore.closeHelp).toHaveBeenCalled()
      expect(sidebarStore.toggleSidebarTab).toHaveBeenCalledWith(
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
      mockSelectedItems.value = [node]

      const state1 = useSelectionState()
      const state2 = useSelectionState()

      const isBypassed1 = state1.selectedNodes.value.some(
        (n) => n.mode === LGraphEventMode.BYPASS
      )
      const isBypassed2 = state2.selectedNodes.value.some(
        (n) => n.mode === LGraphEventMode.BYPASS
      )
      const isPinned1 = state1.selectedNodes.value.some(
        (n) => n.pinned === true
      )
      const isPinned2 = state2.selectedNodes.value.some(
        (n) => n.pinned === true
      )

      expect(isBypassed1).toBe(true)
      expect(isBypassed2).toBe(true)
      expect(isPinned1).toBe(true)
      expect(isPinned2).toBe(true)

      // Test with empty selection using new instances
      mockSelectedItems.value = []
      const emptyState1 = useSelectionState()
      const emptyState2 = useSelectionState()

      expect(emptyState1.hasAnySelection.value).toBe(false)
      expect(emptyState2.hasAnySelection.value).toBe(false)
    })

    test('should support standardized deletability check', () => {
      const deletableNode = createTestNode({ removable: true })
      const nonDeletableNode = createTestNode({ removable: false })

      mockSelectedItems.value = [deletableNode]
      const { isDeletable } = useSelectionState()
      expect(isDeletable.value).toBe(true)

      mockSelectedItems.value = [nonDeletableNode]
      const { isDeletable: isDeletable2 } = useSelectionState()
      expect(isDeletable2.value).toBe(false)

      mockSelectedItems.value = [deletableNode, nonDeletableNode]
      const { isDeletable: isDeletable3 } = useSelectionState()
      // When there's a mix of deletable and non-deletable items,
      // isDeletable returns true because SOME items can be deleted
      expect(isDeletable3.value).toBe(true)
    })
  })

  describe('Special Node Types', () => {
    test('should detect image nodes', () => {
      const imageNode = createTestNode({ type: 'ImageNode' })
      mockSelectedItems.value = [imageNode]

      const { isSingleImageNode, hasImageNode } = useSelectionState()
      expect(isSingleImageNode.value).toBe(true)
      expect(hasImageNode.value).toBe(true)
    })

    test('should detect output nodes', () => {
      const outputNode = createTestNode({ type: 'OutputNode' })
      mockSelectedItems.value = [outputNode]

      const { hasOutputNodesSelected } = useSelectionState()
      expect(hasOutputNodesSelected.value).toBe(true)
    })

    test('should return correct nodeDef for single node', () => {
      const node = createTestNode({ type: 'TestNode' })
      mockSelectedItems.value = [node]

      const { nodeDef } = useSelectionState()
      expect(nodeDef.value).toEqual({
        nodePath: 'test.TestNode',
        name: 'TestNode'
      })
    })

    test('should return null nodeDef for multiple nodes', () => {
      const node1 = createTestNode()
      const node2 = createTestNode()
      mockSelectedItems.value = [node1, node2]

      const { nodeDef } = useSelectionState()
      expect(nodeDef.value).toBeNull()
    })
  })
})
