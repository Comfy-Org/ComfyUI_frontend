import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'

// Import the composable after all mocks
import { useSelectionState } from '@/composables/graph/useSelectionState'

// Define constants before mocks
const LGraphEventMode = {
  ALWAYS: 0,
  ON_EVENT: 1,
  NEVER: 2,
  ON_TRIGGER: 3,
  BYPASS: 4
}

// Mock litegraph module first
vi.mock('@/lib/litegraph/src/litegraph', () => ({
  LGraphEventMode: {
    ALWAYS: 0,
    ON_EVENT: 1,
    NEVER: 2,
    ON_TRIGGER: 3,
    BYPASS: 4
  },
  LGraphNode: class {},
  SubgraphNode: class {}
}))

// Mock stores
const canvasStore = reactive({
  selectedItems: [] as any[]
})
vi.mock('@/stores/graphStore', () => ({
  useCanvasStore: () => canvasStore
}))

const nodeDefStore = reactive({
  fromLGraphNode: vi.fn((node: any) => {
    if (node?.type === 'TestNode') {
      return { nodePath: 'test.TestNode', name: 'TestNode' }
    }
    return null
  })
})
vi.mock('@/stores/nodeDefStore', () => ({
  useNodeDefStore: () => nodeDefStore
}))

const sidebarTabStore = reactive({
  activeSidebarTabId: null as string | null,
  toggleSidebarTab: vi.fn()
})
vi.mock('@/stores/workspace/sidebarTabStore', () => ({
  useSidebarTabStore: () => sidebarTabStore
}))

const nodeHelpStore = reactive({
  isHelpOpen: false,
  currentHelpNode: null as any,
  openHelp: vi.fn(),
  closeHelp: vi.fn()
})
vi.mock('@/stores/workspace/nodeHelpStore', () => ({
  useNodeHelpStore: () => nodeHelpStore
}))

vi.mock('@/composables/sidebarTabs/useNodeLibrarySidebarTab', () => ({
  useNodeLibrarySidebarTab: () => ({ id: 'node-library-tab' })
}))

vi.mock('@/utils/litegraphUtil', () => ({
  isLGraphNode: (item: any) => item?.isNode === true,
  isImageNode: (node: any) => node?.type === 'ImageNode'
}))

vi.mock('@/utils/nodeFilterUtil', () => ({
  filterOutputNodes: (nodes: any[]) =>
    nodes.filter((n) => n.type === 'OutputNode')
}))

// Mock LGraphNode class for testing
class MockLGraphNode {
  type: string
  mode: number
  flags?: { collapsed?: boolean }
  pinned?: boolean
  removable?: boolean
  isNode: boolean = true

  constructor(config: any = {}) {
    this.type = config.type || 'TestNode'
    this.mode = config.mode || LGraphEventMode.ALWAYS
    this.flags = config.flags
    this.pinned = config.pinned
    this.removable = config.removable
  }

  isSubgraphNode() {
    return this instanceof MockSubgraphNode
  }
}

// Create a MockSubgraphNode that extends from our mock for proper testing
class MockSubgraphNode extends MockLGraphNode {
  constructor(config: any = {}) {
    super(config)
    this.type = 'SubgraphNode'
  }

  override isSubgraphNode() {
    return true
  }
}

// Mock comment/connection objects
const mockComment = { type: 'comment', isNode: false }
const mockConnection = { type: 'connection', isNode: false }

describe('useSelectionState', () => {
  beforeEach(() => {
    canvasStore.selectedItems = []
    vi.clearAllMocks()
    nodeDefStore.fromLGraphNode.mockClear()
    nodeHelpStore.isHelpOpen = false
    nodeHelpStore.currentHelpNode = null
    sidebarTabStore.activeSidebarTabId = null
  })

  describe('Selection Detection', () => {
    it('should return false when nothing selected', () => {
      // given: canvasStore.selectedItems = []
      canvasStore.selectedItems = []
      const { hasAnySelection } = useSelectionState()
      expect(hasAnySelection.value).toBe(false)
    })

    it('should return true when items selected', () => {
      // given: canvasStore.selectedItems = [node1, node2]
      const node1 = new MockLGraphNode()
      const node2 = new MockLGraphNode()
      canvasStore.selectedItems = [node1, node2]
      const { hasAnySelection } = useSelectionState()

      // when: hasAnySelection.value
      // then: expect true
      expect(hasAnySelection.value).toBe(true)
    })

    it('should distinguish single vs multiple selections', () => {
      // given: single node selected
      const node = new MockLGraphNode()
      canvasStore.selectedItems = [node]
      const { hasSingleSelection, hasMultipleSelection } = useSelectionState()

      // then: hasSingleSelection = true, hasMultipleSelection = false
      expect(hasSingleSelection.value).toBe(true)
      expect(hasMultipleSelection.value).toBe(false)

      // given: multiple nodes selected
      canvasStore.selectedItems = [node, new MockLGraphNode()]
      expect(hasSingleSelection.value).toBe(false)
      expect(hasMultipleSelection.value).toBe(true)
    })
  })

  describe('Node Type Filtering', () => {
    it('should pick only LGraphNodes from mixed selections', () => {
      // given: [graphNode, comment, connection]
      const graphNode = new MockLGraphNode()
      canvasStore.selectedItems = [graphNode, mockComment, mockConnection]
      const { selectedNodes } = useSelectionState()

      expect(selectedNodes.value).toHaveLength(1)
      expect(selectedNodes.value[0]).toEqual(graphNode)
    })

    it('should detect subgraphs in selection', () => {
      const subgraph = new MockSubgraphNode()
      canvasStore.selectedItems = [subgraph]
      const { hasSubgraphs, isSingleSubgraph } = useSelectionState()
      expect(hasSubgraphs.value).toBe(true)
      expect(isSingleSubgraph.value).toBe(true)
    })
  })

  describe('Node State Computation', () => {
    it('should detect bypassed nodes', () => {
      // given: node with mode = LGraphEventMode.BYPASS
      const bypassedNode = new MockLGraphNode({ mode: LGraphEventMode.BYPASS })
      canvasStore.selectedItems = [bypassedNode]
      const { selectedNodesStates } = useSelectionState()

      expect(selectedNodesStates.value.bypassed).toBe(true)
    })

    it('should detect pinned/collapsed states', () => {
      // given: mixed pinned/collapsed nodes
      const pinnedNode = new MockLGraphNode({ pinned: true })
      const collapsedNode = new MockLGraphNode({ flags: { collapsed: true } })
      canvasStore.selectedItems = [pinnedNode, collapsedNode]
      const { selectedNodesStates } = useSelectionState()

      // when: selectedNodesStates.value
      // then: correct state flags
      expect(selectedNodesStates.value.pinned).toBe(true)
      expect(selectedNodesStates.value.collapsed).toBe(true)
      expect(selectedNodesStates.value.bypassed).toBe(false)
    })

    it('should provide non-reactive state computation', () => {
      // given: performance-sensitive context
      const node = new MockLGraphNode({ pinned: true })
      canvasStore.selectedItems = [node]
      const { computeSelectionFlags } = useSelectionState()

      // when: computeSelectionFlags()
      const flags = computeSelectionFlags()

      // then: fresh state without watchers
      expect(flags.pinned).toBe(true)
      expect(flags.collapsed).toBe(false)
      expect(flags.bypassed).toBe(false)

      // Verify it's a fresh computation by changing selection
      canvasStore.selectedItems = []
      const newFlags = computeSelectionFlags()
      expect(newFlags.pinned).toBe(false)
    })
  })

  describe('Data Integrity', () => {
    it('should handle missing removable property', () => {
      // given: node without removable field
      const node = new MockLGraphNode()
      delete node.removable
      canvasStore.selectedItems = [node]
      const { selectedItems } = useSelectionState()

      // when: checking deletability
      // then: treats undefined as deletable
      expect(selectedItems.value[0].removable).toBeUndefined()
    })

    it('should return default states for empty selection', () => {
      // given: no selection
      canvasStore.selectedItems = []
      const { selectedNodesStates } = useSelectionState()
      expect(selectedNodesStates.value).toEqual({
        collapsed: false,
        pinned: false,
        bypassed: false
      })
    })
  })

  describe('Help Integration', () => {
    it('should show help for single node', async () => {
      // given: one node selected
      const node = new MockLGraphNode({ type: 'TestNode' })
      canvasStore.selectedItems = [node]
      const { showNodeHelp } = useSelectionState()

      // when: showNodeHelp()
      showNodeHelp()
      await nextTick()

      // then: opens help sidebar
      expect(sidebarTabStore.toggleSidebarTab).toHaveBeenCalledWith(
        'node-library-tab'
      )
      expect(nodeHelpStore.openHelp).toHaveBeenCalledWith({
        nodePath: 'test.TestNode',
        name: 'TestNode'
      })
    })

    it('should ignore help request for multiple nodes', () => {
      // given: multiple nodes selected
      const node1 = new MockLGraphNode()
      const node2 = new MockLGraphNode()
      canvasStore.selectedItems = [node1, node2]
      const { showNodeHelp } = useSelectionState()

      // when: showNodeHelp()
      showNodeHelp()

      // then: does nothing
      expect(sidebarTabStore.toggleSidebarTab).not.toHaveBeenCalled()
      expect(nodeHelpStore.openHelp).not.toHaveBeenCalled()
    })

    it('should toggle help when same node help is already open', async () => {
      // given: help already open for same node
      const node = new MockLGraphNode({ type: 'TestNode' })
      canvasStore.selectedItems = [node]
      sidebarTabStore.activeSidebarTabId = 'node-library-tab'
      nodeHelpStore.isHelpOpen = true
      nodeHelpStore.currentHelpNode = { nodePath: 'test.TestNode' }

      const { showNodeHelp } = useSelectionState()

      // when: showNodeHelp()
      showNodeHelp()
      await nextTick()

      // then: closes help
      expect(nodeHelpStore.closeHelp).toHaveBeenCalled()
      expect(sidebarTabStore.toggleSidebarTab).toHaveBeenCalledWith(
        'node-library-tab'
      )
    })
  })

  describe('Button Pattern Consistency', () => {
    it('should provide consistent state for all buttons', async () => {
      // given: multiple components using useSelectionState
      const node = new MockLGraphNode({
        mode: LGraphEventMode.BYPASS,
        pinned: true
      })
      canvasStore.selectedItems = [node]

      const state1 = useSelectionState()
      const state2 = useSelectionState()

      // when: selection changes
      // then: all buttons react consistently
      expect(state1.selectedNodesStates.value.bypassed).toBe(true)
      expect(state2.selectedNodesStates.value.bypassed).toBe(true)
      expect(state1.selectedNodesStates.value.pinned).toBe(true)
      expect(state2.selectedNodesStates.value.pinned).toBe(true)

      // Change selection and verify consistency
      canvasStore.selectedItems = []
      await nextTick()

      expect(state1.hasAnySelection.value).toBe(false)
      expect(state2.hasAnySelection.value).toBe(false)
    })

    it('should support standardized deletability check', () => {
      // given: selectedItems from composable
      const deletableNode = new MockLGraphNode({ removable: true })
      const nonDeletableNode = new MockLGraphNode({ removable: false })

      canvasStore.selectedItems = [deletableNode]
      const { selectedItems: items1 } = useSelectionState()

      // when: compute isDeletable
      // then: consistent pattern across buttons
      const isDeletable1 = items1.value.every(
        (item) => item.removable !== false
      )
      expect(isDeletable1).toBe(true)

      canvasStore.selectedItems = [nonDeletableNode]
      const { selectedItems: items2 } = useSelectionState()
      const isDeletable2 = items2.value.every(
        (item) => item.removable !== false
      )
      expect(isDeletable2).toBe(false)

      // Mixed selection
      canvasStore.selectedItems = [deletableNode, nonDeletableNode]
      const { selectedItems: items3 } = useSelectionState()
      const isDeletable3 = items3.value.every(
        (item) => item.removable !== false
      )
      expect(isDeletable3).toBe(false)
    })
  })

  describe('Special Node Types', () => {
    it('should detect image nodes', () => {
      const imageNode = new MockLGraphNode({ type: 'ImageNode' })
      canvasStore.selectedItems = [imageNode]
      const { isSingleImageNode, hasImageNode } = useSelectionState()

      expect(isSingleImageNode.value).toBe(true)
      expect(hasImageNode.value).toBe(true)
    })

    it('should detect output nodes', () => {
      const outputNode = new MockLGraphNode({ type: 'OutputNode' })
      canvasStore.selectedItems = [outputNode]
      const { hasOutputNodesSelected } = useSelectionState()

      expect(hasOutputNodesSelected.value).toBe(true)
    })

    it('should return correct nodeDef for single node', () => {
      const node = new MockLGraphNode({ type: 'TestNode' })
      canvasStore.selectedItems = [node]
      const { nodeDef } = useSelectionState()

      expect(nodeDef.value).toEqual({
        nodePath: 'test.TestNode',
        name: 'TestNode'
      })
    })

    it('should return null nodeDef for multiple nodes', () => {
      const node1 = new MockLGraphNode()
      const node2 = new MockLGraphNode()
      canvasStore.selectedItems = [node1, node2]
      const { nodeDef } = useSelectionState()

      expect(nodeDef.value).toBeNull()
    })
  })
})
