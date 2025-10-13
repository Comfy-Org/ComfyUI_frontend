import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, shallowRef } from 'vue'

import {
  type GraphNodeManager,
  type VueNodeData,
  useGraphNodeManager
} from '@/composables/graph/useGraphNodeManager'
import { useVueNodeLifecycle } from '@/composables/graph/useVueNodeLifecycle'
import type {
  LGraph,
  LGraphCanvas,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { useNodeEventHandlers } from '@/renderer/extensions/vueNodes/composables/useNodeEventHandlers'

vi.mock('@/renderer/core/canvas/canvasStore', () => {
  const canvas: Partial<LGraphCanvas> = {
    select: vi.fn(),
    deselect: vi.fn(),
    deselectAll: vi.fn()
  }
  const updateSelectedItems = vi.fn()
  return {
    useCanvasStore: vi.fn(() => ({
      canvas: canvas as LGraphCanvas,
      updateSelectedItems,
      selectedItems: []
    }))
  }
})

vi.mock('@/renderer/core/canvas/useCanvasInteractions', () => ({
  useCanvasInteractions: vi.fn(() => ({
    shouldHandleNodePointerEvents: computed(() => true) // Default to allowing pointer events
  }))
}))

vi.mock('@/renderer/core/layout/operations/layoutMutations', () => {
  const setSource = vi.fn()
  const bringNodeToFront = vi.fn()
  return {
    useLayoutMutations: vi.fn(() => ({
      setSource,
      bringNodeToFront
    }))
  }
})

vi.mock('@/composables/graph/useGraphNodeManager', () => {
  const mockNode = {
    id: 'node-1',
    selected: false,
    flags: { pinned: false }
  }
  const nodeManager = shallowRef({
    getNode: vi.fn(() => mockNode as Partial<LGraphNode> as LGraphNode)
  } as Partial<GraphNodeManager> as GraphNodeManager)
  return {
    useGraphNodeManager: vi.fn(() => nodeManager)
  }
})

vi.mock('@/composables/graph/useVueNodeLifecycle', () => {
  const nodeManager = useGraphNodeManager(undefined as unknown as LGraph)
  return {
    useVueNodeLifecycle: vi.fn(() => ({
      nodeManager
    }))
  }
})

describe('useNodeEventHandlers', () => {
  const { nodeManager: mockNodeManager } = useVueNodeLifecycle()

  const mockNode = mockNodeManager.value!.getNode('fake_id')
  const mockLayoutMutations = useLayoutMutations()

  const testNodeData: VueNodeData = {
    id: 'node-1',
    title: 'Test Node',
    type: 'test',
    mode: 0,
    selected: false,
    executing: false
  }

  beforeEach(async () => {
    vi.restoreAllMocks()
  })

  describe('handleNodeSelect', () => {
    it('should select single node on regular click', () => {
      const { handleNodeSelect } = useNodeEventHandlers()
      const { canvas, updateSelectedItems } = useCanvasStore()

      const event = new PointerEvent('pointerdown', {
        bubbles: true,
        ctrlKey: false,
        metaKey: false
      })

      handleNodeSelect(event, testNodeData)

      expect(canvas?.deselectAll).toHaveBeenCalledOnce()
      expect(canvas?.select).toHaveBeenCalledWith(mockNode)
      expect(updateSelectedItems).toHaveBeenCalledOnce()
    })

    it('should toggle selection on ctrl+click', () => {
      const { handleNodeSelect } = useNodeEventHandlers()
      const { canvas } = useCanvasStore()

      // Test selecting unselected node with ctrl
      mockNode!.selected = false

      const ctrlClickEvent = new PointerEvent('pointerdown', {
        bubbles: true,
        ctrlKey: true,
        metaKey: false
      })

      handleNodeSelect(ctrlClickEvent, testNodeData)

      expect(canvas?.deselectAll).not.toHaveBeenCalled()
      expect(canvas?.select).toHaveBeenCalledWith(mockNode)
    })

    it('should deselect on ctrl+click of selected node', () => {
      const { handleNodeSelect } = useNodeEventHandlers()
      const { canvas } = useCanvasStore()

      // Test deselecting selected node with ctrl
      mockNode!.selected = true

      const ctrlClickEvent = new PointerEvent('pointerdown', {
        bubbles: true,
        ctrlKey: true,
        metaKey: false
      })

      handleNodeSelect(ctrlClickEvent, testNodeData)

      expect(canvas?.deselect).toHaveBeenCalledWith(mockNode)
      expect(canvas?.select).not.toHaveBeenCalled()
    })

    it('should handle meta key (Cmd) on Mac', () => {
      const { handleNodeSelect } = useNodeEventHandlers()
      const { canvas } = useCanvasStore()

      mockNode!.selected = false

      const metaClickEvent = new PointerEvent('pointerdown', {
        bubbles: true,
        ctrlKey: false,
        metaKey: true
      })

      handleNodeSelect(metaClickEvent, testNodeData)

      expect(canvas?.select).toHaveBeenCalledWith(mockNode)
      expect(canvas?.deselectAll).not.toHaveBeenCalled()
    })

    it('should bring node to front when not pinned', () => {
      const { handleNodeSelect } = useNodeEventHandlers()

      mockNode!.flags.pinned = false

      const event = new PointerEvent('pointerdown')
      handleNodeSelect(event, testNodeData)

      expect(mockLayoutMutations.bringNodeToFront).toHaveBeenCalledWith(
        'node-1'
      )
    })

    it('should not bring pinned node to front', () => {
      const { handleNodeSelect } = useNodeEventHandlers()

      mockNode!.flags.pinned = true

      const event = new PointerEvent('pointerdown')
      handleNodeSelect(event, testNodeData)

      expect(mockLayoutMutations.bringNodeToFront).not.toHaveBeenCalled()
    })
  })
})
