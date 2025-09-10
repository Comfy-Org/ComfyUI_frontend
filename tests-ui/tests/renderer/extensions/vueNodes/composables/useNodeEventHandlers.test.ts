import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { useGraphNodeManager } from '@/composables/graph/useGraphNodeManager'
import type { LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { useNodeEventHandlers } from '@/renderer/extensions/vueNodes/composables/useNodeEventHandlers'
import { useCanvasStore } from '@/stores/graphStore'

vi.mock('@/stores/graphStore', () => ({
  useCanvasStore: vi.fn()
}))

vi.mock('@/renderer/core/layout/operations/layoutMutations', () => ({
  useLayoutMutations: vi.fn()
}))

function createMockCanvas(): Pick<
  LGraphCanvas,
  'select' | 'deselect' | 'deselectAll'
> {
  return {
    select: vi.fn(),
    deselect: vi.fn(),
    deselectAll: vi.fn()
  }
}

function createMockNode(): Pick<LGraphNode, 'id' | 'selected' | 'flags'> {
  return {
    id: 'node-1',
    selected: false,
    flags: { pinned: false }
  }
}

function createMockNodeManager(
  node: Pick<LGraphNode, 'id' | 'selected' | 'flags'>
) {
  return {
    getNode: vi.fn().mockReturnValue(node) as ReturnType<
      typeof useGraphNodeManager
    >['getNode']
  }
}

function createMockCanvasStore(
  canvas: Pick<LGraphCanvas, 'select' | 'deselect' | 'deselectAll'>
): Pick<
  ReturnType<typeof useCanvasStore>,
  'canvas' | 'selectedItems' | 'updateSelectedItems'
> {
  return {
    canvas: canvas as LGraphCanvas,
    selectedItems: [],
    updateSelectedItems: vi.fn()
  }
}

function createMockLayoutMutations(): Pick<
  ReturnType<typeof useLayoutMutations>,
  'setSource' | 'bringNodeToFront'
> {
  return {
    setSource: vi.fn(),
    bringNodeToFront: vi.fn()
  }
}

describe('useNodeEventHandlers', () => {
  let mockCanvas: ReturnType<typeof createMockCanvas>
  let mockNode: ReturnType<typeof createMockNode>
  let mockNodeManager: ReturnType<typeof createMockNodeManager>
  let mockCanvasStore: ReturnType<typeof createMockCanvasStore>
  let mockLayoutMutations: ReturnType<typeof createMockLayoutMutations>

  const testNodeData: VueNodeData = {
    id: 'node-1',
    title: 'Test Node',
    type: 'test',
    mode: 0,
    selected: false,
    executing: false
  }

  beforeEach(async () => {
    mockNode = createMockNode()
    mockCanvas = createMockCanvas()
    mockNodeManager = createMockNodeManager(mockNode)
    mockCanvasStore = createMockCanvasStore(mockCanvas)
    mockLayoutMutations = createMockLayoutMutations()

    vi.mocked(useCanvasStore).mockReturnValue(
      mockCanvasStore as ReturnType<typeof useCanvasStore>
    )
    vi.mocked(useLayoutMutations).mockReturnValue(
      mockLayoutMutations as ReturnType<typeof useLayoutMutations>
    )
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

      handleNodeSelect(event, testNodeData)

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

      handleNodeSelect(ctrlClickEvent, testNodeData)

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

      handleNodeSelect(ctrlClickEvent, testNodeData)

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

      handleNodeSelect(metaClickEvent, testNodeData)

      expect(mockCanvas.select).toHaveBeenCalledWith(mockNode)
      expect(mockCanvas.deselectAll).not.toHaveBeenCalled()
    })

    it('should bring node to front when not pinned', () => {
      const nodeManager = ref(mockNodeManager)
      const { handleNodeSelect } = useNodeEventHandlers(nodeManager)

      mockNode.flags.pinned = false

      const event = new PointerEvent('pointerdown')
      handleNodeSelect(event, testNodeData)

      expect(mockLayoutMutations.bringNodeToFront).toHaveBeenCalledWith(
        'node-1'
      )
    })

    it('should not bring pinned node to front', () => {
      const nodeManager = ref(mockNodeManager)
      const { handleNodeSelect } = useNodeEventHandlers(nodeManager)

      mockNode.flags.pinned = true

      const event = new PointerEvent('pointerdown')
      handleNodeSelect(event, testNodeData)

      expect(mockLayoutMutations.bringNodeToFront).not.toHaveBeenCalled()
    })

    it('should handle missing canvas gracefully', () => {
      const nodeManager = ref(mockNodeManager)
      const { handleNodeSelect } = useNodeEventHandlers(nodeManager)

      mockCanvasStore.canvas = null

      const event = new PointerEvent('pointerdown')
      expect(() => {
        handleNodeSelect(event, testNodeData)
      }).not.toThrow()

      expect(mockCanvas.select).not.toHaveBeenCalled()
    })

    it('should handle missing node gracefully', () => {
      const nodeManager = ref(mockNodeManager)
      const { handleNodeSelect } = useNodeEventHandlers(nodeManager)

      vi.mocked(mockNodeManager.getNode).mockReturnValue(undefined)

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
