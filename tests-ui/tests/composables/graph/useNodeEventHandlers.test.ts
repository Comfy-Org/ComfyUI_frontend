import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { useNodeEventHandlers } from '@/composables/graph/useNodeEventHandlers'
import type { Positionable } from '@/lib/litegraph/src/interfaces'

vi.mock('@/stores/graphStore')
vi.mock('@/renderer/core/layout/operations/layoutMutations')

interface MockCanvas {
  select: ReturnType<typeof vi.fn>
  deselect: ReturnType<typeof vi.fn>
  deselectAll: ReturnType<typeof vi.fn>
  updateSelectedItems: ReturnType<typeof vi.fn>
}

interface MockLGraphNode {
  id: string
  selected: boolean
  flags: {
    pinned: boolean
  }
}

interface MockNodeManager {
  getNode: ReturnType<typeof vi.fn>
}

interface MockCanvasStore {
  canvas: MockCanvas | null
  selectedItems: Positionable[]
  updateSelectedItems: ReturnType<typeof vi.fn>
}

interface MockLayoutMutations {
  setSource: ReturnType<typeof vi.fn>
  bringNodeToFront: ReturnType<typeof vi.fn>
}

describe('useNodeEventHandlers', () => {
  let mockCanvas: MockCanvas
  let mockNode: MockLGraphNode
  let mockNodeManager: MockNodeManager
  let mockCanvasStore: MockCanvasStore
  let mockLayoutMutations: MockLayoutMutations

  beforeEach(async () => {
    // Mock LiteGraph node
    mockNode = {
      id: 'node-1',
      selected: false,
      flags: { pinned: false }
    }

    // Mock canvas with select/deselect methods
    mockCanvas = {
      select: vi.fn(),
      deselect: vi.fn(),
      deselectAll: vi.fn(),
      updateSelectedItems: vi.fn()
    }

    // Mock node manager
    mockNodeManager = {
      getNode: vi.fn().mockReturnValue(mockNode)
    }

    // Mock canvas store
    mockCanvasStore = {
      canvas: mockCanvas,
      selectedItems: [],
      updateSelectedItems: vi.fn()
    }

    // Mock layout mutations
    mockLayoutMutations = {
      setSource: vi.fn(),
      bringNodeToFront: vi.fn()
    }

    // Setup module mocks
    const { useCanvasStore } = await import('@/stores/graphStore')
    const { useLayoutMutations } = await import(
      '@/renderer/core/layout/operations/layoutMutations'
    )

    // @ts-expect-error - Test mocks only need minimal interface, full Pinia store type too complex
    vi.mocked(useCanvasStore).mockImplementation(() => mockCanvasStore)

    // @ts-expect-error - Test mocks only need minimal interface, full LayoutMutations type too complex
    vi.mocked(useLayoutMutations).mockImplementation(() => mockLayoutMutations)
  })

  describe('handleNodeSelect', () => {
    it('should select single node on regular click', () => {
      const nodeManager = ref(mockNodeManager)
      const { handleNodeSelect } = useNodeEventHandlers(nodeManager)

      const event = new PointerEvent('pointerdown', {
        bubbles: true,
        ctrlKey: false,
        metaKey: false
      })

      const nodeData: VueNodeData = {
        id: 'node-1',
        title: 'Test Node',
        type: 'test',
        mode: 0,
        selected: false,
        executing: false
      }

      handleNodeSelect(event, nodeData)

      expect(mockCanvas.deselectAll).toHaveBeenCalledOnce()
      expect(mockCanvas.select).toHaveBeenCalledWith(mockNode)
      expect(mockCanvasStore.updateSelectedItems).toHaveBeenCalledOnce()
    })

    it('should toggle selection on ctrl+click', () => {
      const nodeManager = ref(mockNodeManager)
      const { handleNodeSelect } = useNodeEventHandlers(nodeManager)

      // Test selecting unselected node with ctrl
      mockNode.selected = false

      const ctrlClickEvent = new PointerEvent('pointerdown', {
        bubbles: true,
        ctrlKey: true,
        metaKey: false
      })

      const nodeData: VueNodeData = {
        id: 'node-1',
        title: 'Test Node',
        type: 'test',
        mode: 0,
        selected: false,
        executing: false
      }

      handleNodeSelect(ctrlClickEvent, nodeData)

      expect(mockCanvas.deselectAll).not.toHaveBeenCalled()
      expect(mockCanvas.select).toHaveBeenCalledWith(mockNode)
    })

    it('should deselect on ctrl+click of selected node', () => {
      const nodeManager = ref(mockNodeManager)
      const { handleNodeSelect } = useNodeEventHandlers(nodeManager)

      // Test deselecting selected node with ctrl
      mockNode.selected = true

      const ctrlClickEvent = new PointerEvent('pointerdown', {
        bubbles: true,
        ctrlKey: true,
        metaKey: false
      })

      const nodeData: VueNodeData = {
        id: 'node-1',
        title: 'Test Node',
        type: 'test',
        mode: 0,
        selected: false,
        executing: false
      }

      handleNodeSelect(ctrlClickEvent, nodeData)

      expect(mockCanvas.deselect).toHaveBeenCalledWith(mockNode)
      expect(mockCanvas.select).not.toHaveBeenCalled()
    })

    it('should handle meta key (Cmd) on Mac', () => {
      const nodeManager = ref(mockNodeManager)
      const { handleNodeSelect } = useNodeEventHandlers(nodeManager)

      mockNode.selected = false

      const metaClickEvent = new PointerEvent('pointerdown', {
        bubbles: true,
        ctrlKey: false,
        metaKey: true
      })

      const nodeData: VueNodeData = {
        id: 'node-1',
        title: 'Test Node',
        type: 'test',
        mode: 0,
        selected: false,
        executing: false
      }

      handleNodeSelect(metaClickEvent, nodeData)

      expect(mockCanvas.select).toHaveBeenCalledWith(mockNode)
      expect(mockCanvas.deselectAll).not.toHaveBeenCalled()
    })

    it('should bring node to front when not pinned', () => {
      const nodeManager = ref(mockNodeManager)
      const { handleNodeSelect } = useNodeEventHandlers(nodeManager)

      mockNode.flags.pinned = false

      const event = new PointerEvent('pointerdown')
      const nodeData: VueNodeData = {
        id: 'node-1',
        title: 'Test Node',
        type: 'test',
        mode: 0,
        selected: false,
        executing: false
      }

      handleNodeSelect(event, nodeData)

      expect(mockLayoutMutations.bringNodeToFront).toHaveBeenCalledWith(
        'node-1'
      )
    })

    it('should not bring pinned node to front', () => {
      const nodeManager = ref(mockNodeManager)
      const { handleNodeSelect } = useNodeEventHandlers(nodeManager)

      mockNode.flags.pinned = true

      const event = new PointerEvent('pointerdown')
      const nodeData: VueNodeData = {
        id: 'node-1',
        title: 'Test Node',
        type: 'test',
        mode: 0,
        selected: false,
        executing: false
      }

      handleNodeSelect(event, nodeData)

      expect(mockLayoutMutations.bringNodeToFront).not.toHaveBeenCalled()
    })

    it('should handle missing canvas gracefully', () => {
      const nodeManager = ref(mockNodeManager)
      const { handleNodeSelect } = useNodeEventHandlers(nodeManager)

      mockCanvasStore.canvas = null

      const event = new PointerEvent('pointerdown')
      const nodeData: VueNodeData = {
        id: 'node-1',
        title: 'Test Node',
        type: 'test',
        mode: 0,
        selected: false,
        executing: false
      }

      expect(() => {
        handleNodeSelect(event, nodeData)
      }).not.toThrow()

      expect(mockCanvas.select).not.toHaveBeenCalled()
    })

    it('should handle missing node gracefully', () => {
      const nodeManager = ref(mockNodeManager)
      const { handleNodeSelect } = useNodeEventHandlers(nodeManager)

      mockNodeManager.getNode.mockReturnValue(null)

      const event = new PointerEvent('pointerdown')
      const nodeData = {
        id: 'missing-node',
        title: 'Missing Node',
        type: 'test'
      } as any

      expect(() => {
        handleNodeSelect(event, nodeData)
      }).not.toThrow()

      expect(mockCanvas.select).not.toHaveBeenCalled()
    })
  })
})
