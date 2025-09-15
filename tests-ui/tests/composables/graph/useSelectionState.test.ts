import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { type Ref, ref } from 'vue'

import { useSelectionState } from '@/composables/graph/useSelectionState'
import { useNodeLibrarySidebarTab } from '@/composables/sidebarTabs/useNodeLibrarySidebarTab'
import { LGraphEventMode } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
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
vi.mock('@/renderer/core/canvas/canvasStore', () => ({
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
      // Update the mock data before creating the composable
      const node1 = createTestNode()
      const node2 = createTestNode()
      mockSelectedItems.value = [node1, node2]

      const { hasAnySelection } = useSelectionState()
      expect(hasAnySelection.value).toBe(true)
    })
  })

  describe('Node Type Filtering', () => {
    test('should pick only LGraphNodes from mixed selections', () => {
      // Update the mock data before creating the composable
      const graphNode = createTestNode()
      mockSelectedItems.value = [graphNode, mockComment, mockConnection]

      const { selectedNodes } = useSelectionState()
      expect(selectedNodes.value).toHaveLength(1)
      expect(selectedNodes.value[0]).toEqual(graphNode)
    })
  })

  describe('Node State Computation', () => {
    test('should detect bypassed nodes', () => {
      // Update the mock data before creating the composable
      const bypassedNode = createTestNode({ mode: LGraphEventMode.BYPASS })
      mockSelectedItems.value = [bypassedNode]

      const { selectedNodes } = useSelectionState()
      const isBypassed = selectedNodes.value.some(
        (n) => n.mode === LGraphEventMode.BYPASS
      )
      expect(isBypassed).toBe(true)
    })

    test('should detect pinned/collapsed states', () => {
      // Update the mock data before creating the composable
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
      // Update the mock data before creating the composable
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
})
