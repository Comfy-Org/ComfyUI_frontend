import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { useSelectionState } from '@/composables/graph/useSelectionState'
import { LGraphEventMode } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { ComfyNodeDefImpl, useNodeDefStore } from '@/stores/nodeDefStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import { isImageNode, isLGraphNode } from '@/utils/litegraphUtil'
import { filterOutputNodes } from '@/utils/nodeFilterUtil'
import {
  createMockLGraphNode,
  createMockPositionable
} from '@/utils/__tests__/litegraphTestUtils'

vi.mock('@/utils/litegraphUtil', () => ({
  isLGraphNode: vi.fn(),
  isImageNode: vi.fn()
}))

vi.mock('@/utils/nodeFilterUtil', () => ({
  filterOutputNodes: vi.fn()
}))

// Mock comment/connection objects with additional properties
const mockComment = {
  ...createMockPositionable({ id: 999 }),
  type: 'comment',
  isNode: false
}
const mockConnection = {
  ...createMockPositionable({ id: 1000 }),
  type: 'connection',
  isNode: false
}

function createMockNodeDef() {
  return new ComfyNodeDefImpl({
    name: 'TestNode',
    display_name: 'Test Node',
    category: 'test',
    input: {},
    output: [],
    output_name: [],
    output_is_list: [],
    output_node: false,
    python_module: 'nodes',
    description: ''
  })
}

function selectSingleNodeWithNodeDef(id: number) {
  const canvasStore = useCanvasStore()
  const nodeDefStore = useNodeDefStore()

  canvasStore.$state.selectedItems = [
    createMockLGraphNode({ id, type: 'TestNode' })
  ]
  vi.mocked(nodeDefStore.fromLGraphNode).mockReturnValue(createMockNodeDef())
}

function mockSettingValues(overrides: Record<string, unknown> = {}) {
  const settingStore = useSettingStore()
  const settingValues: Record<string, unknown> = {
    'Comfy.UseNewMenu': 'Top',
    'Comfy.NodeLibrary.NewDesign': true,
    'Comfy.Load3D.3DViewerEnable': false,
    ...overrides
  }

  vi.mocked(settingStore.get).mockImplementation(
    (key: string): unknown => settingValues[key]
  )
}

describe('useSelectionState', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Create testing Pinia instance
    setActivePinia(
      createTestingPinia({
        createSpy: vi.fn
      })
    )
    mockSettingValues()

    // Setup mock utility functions
    vi.mocked(isLGraphNode).mockImplementation((item: unknown) => {
      const typedItem = item as { isNode?: boolean }
      return typedItem?.isNode !== false
    })
    vi.mocked(isImageNode).mockImplementation((node: unknown) => {
      const typedNode = node as { type?: string }
      return typedNode?.type === 'ImageNode'
    })
    vi.mocked(filterOutputNodes).mockImplementation((nodes) =>
      nodes.filter((n) => n.type === 'OutputNode')
    )
  })

  describe('Selection Detection', () => {
    test('should return false when nothing selected', () => {
      const { hasAnySelection } = useSelectionState()
      expect(hasAnySelection.value).toBe(false)
    })

    test('should return true when items selected', () => {
      const canvasStore = useCanvasStore()
      const node1 = createMockLGraphNode({ id: 1 })
      const node2 = createMockLGraphNode({ id: 2 })
      canvasStore.$state.selectedItems = [node1, node2]

      const { hasAnySelection } = useSelectionState()
      expect(hasAnySelection.value).toBe(true)
    })

    test('hasMultipleSelection should be true when 2+ items selected', () => {
      const canvasStore = useCanvasStore()
      const node1 = createMockLGraphNode({ id: 1 })
      const node2 = createMockLGraphNode({ id: 2 })
      canvasStore.$state.selectedItems = [node1, node2]

      const { hasMultipleSelection } = useSelectionState()
      expect(hasMultipleSelection.value).toBe(true)
    })

    test('hasMultipleSelection should be false when only 1 item selected', () => {
      const canvasStore = useCanvasStore()
      const node1 = createMockLGraphNode({ id: 1 })
      canvasStore.$state.selectedItems = [node1]

      const { hasMultipleSelection } = useSelectionState()
      expect(hasMultipleSelection.value).toBe(false)
    })
  })

  describe('Node Type Filtering', () => {
    test('should pick only LGraphNodes from mixed selections', () => {
      const canvasStore = useCanvasStore()
      const graphNode = createMockLGraphNode({ id: 3 })
      canvasStore.$state.selectedItems = [
        graphNode,
        mockComment,
        mockConnection
      ]

      const { selectedNodes } = useSelectionState()
      expect(selectedNodes.value).toHaveLength(1)
      expect(selectedNodes.value[0]).toEqual(graphNode)
    })
  })

  describe('Node State Computation', () => {
    test('should detect bypassed nodes', () => {
      const canvasStore = useCanvasStore()
      const bypassedNode = createMockLGraphNode({
        id: 4,
        mode: LGraphEventMode.BYPASS
      })
      canvasStore.$state.selectedItems = [bypassedNode]

      const { selectedNodes } = useSelectionState()
      const isBypassed = selectedNodes.value.some(
        (n) => n.mode === LGraphEventMode.BYPASS
      )
      expect(isBypassed).toBe(true)
    })

    test('should detect pinned/collapsed states', () => {
      const canvasStore = useCanvasStore()
      const pinnedNode = createMockLGraphNode({ id: 5, pinned: true })
      const collapsedNode = createMockLGraphNode({
        id: 6,
        flags: { collapsed: true }
      })
      canvasStore.$state.selectedItems = [pinnedNode, collapsedNode]

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
      const canvasStore = useCanvasStore()
      const node = createMockLGraphNode({ id: 7, pinned: true })
      canvasStore.$state.selectedItems = [node]

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
      canvasStore.$state.selectedItems = []
      const { selectedNodes: newSelectedNodes } = useSelectionState()
      const newIsPinned = newSelectedNodes.value.some((n) => n.pinned === true)
      expect(newIsPinned).toBe(false)
    })
  })

  describe('Node Info', () => {
    test('should open the right side info panel for a selected node', () => {
      const rightSidePanelStore = useRightSidePanelStore()
      selectSingleNodeWithNodeDef(8)

      const { canOpenNodeInfo, openNodeInfo } = useSelectionState()
      expect(canOpenNodeInfo.value).toBe(true)
      openNodeInfo()

      expect(rightSidePanelStore.openPanel).toHaveBeenCalledWith('info')
    })

    test('should not open the right side panel for multiple selected nodes', () => {
      const canvasStore = useCanvasStore()
      const rightSidePanelStore = useRightSidePanelStore()
      canvasStore.$state.selectedItems = [
        createMockLGraphNode({ id: 9, type: 'TestNode' }),
        createMockLGraphNode({ id: 10, type: 'TestNode' })
      ]

      const { canOpenNodeInfo, openNodeInfo } = useSelectionState()
      expect(canOpenNodeInfo.value).toBe(false)
      openNodeInfo()

      expect(rightSidePanelStore.openPanel).not.toHaveBeenCalled()
    })

    test('should open the right side info panel when new menu uses the legacy node library', () => {
      const rightSidePanelStore = useRightSidePanelStore()
      mockSettingValues({
        'Comfy.UseNewMenu': 'Top',
        'Comfy.NodeLibrary.NewDesign': false
      })
      selectSingleNodeWithNodeDef(11)

      const { canOpenNodeInfo, openNodeInfo } = useSelectionState()
      expect(canOpenNodeInfo.value).toBe(true)

      const didOpen = openNodeInfo()

      expect(didOpen).toBe(true)
      expect(rightSidePanelStore.openPanel).toHaveBeenCalledWith('info')
    })

    test('should not open node info when legacy menu uses the new node library', () => {
      const rightSidePanelStore = useRightSidePanelStore()
      mockSettingValues({
        'Comfy.UseNewMenu': 'Disabled',
        'Comfy.NodeLibrary.NewDesign': true
      })
      selectSingleNodeWithNodeDef(12)

      const { canOpenNodeInfo, openNodeInfo } = useSelectionState()
      expect(canOpenNodeInfo.value).toBe(false)

      const didOpen = openNodeInfo()

      expect(didOpen).toBe(false)
      expect(rightSidePanelStore.openPanel).not.toHaveBeenCalled()
    })

    test('should not open node info when legacy menu uses the legacy node library', () => {
      const rightSidePanelStore = useRightSidePanelStore()
      mockSettingValues({
        'Comfy.UseNewMenu': 'Disabled',
        'Comfy.NodeLibrary.NewDesign': false
      })
      selectSingleNodeWithNodeDef(13)

      const { canOpenNodeInfo, openNodeInfo } = useSelectionState()
      expect(canOpenNodeInfo.value).toBe(false)

      const didOpen = openNodeInfo()

      expect(didOpen).toBe(false)
      expect(rightSidePanelStore.openPanel).not.toHaveBeenCalled()
    })
  })
})
