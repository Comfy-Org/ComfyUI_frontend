import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, shallowRef } from 'vue'

import { useGraphNodeManager } from '@/composables/graph/useGraphNodeManager'
import type {
  GraphNodeManager,
  VueNodeData
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
    vi.clearAllMocks()
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

    it('on pointer down with ctrl+click: brings node to front only, no selection changes', () => {
      const { handleNodeSelect } = useNodeEventHandlers()
      const { canvas } = useCanvasStore()

      mockNode!.selected = false

      const ctrlClickEvent = new PointerEvent('pointerdown', {
        bubbles: true,
        ctrlKey: true,
        metaKey: false
      })

      handleNodeSelect(ctrlClickEvent, testNodeData)

      // On pointer down with multi-select: bring to front
      expect(mockLayoutMutations.bringNodeToFront).toHaveBeenCalledWith(
        'node-1'
      )

      // But don't change selection state yet (deferred to pointer up)
      expect(canvas?.deselectAll).not.toHaveBeenCalled()
      expect(canvas?.select).not.toHaveBeenCalled()
      expect(canvas?.deselect).not.toHaveBeenCalled()
    })

    it('on pointer down with ctrl+click of selected node: brings node to front only', () => {
      const { handleNodeSelect } = useNodeEventHandlers()
      const { canvas } = useCanvasStore()

      mockNode!.selected = true
      mockNode!.flags.pinned = false

      const ctrlClickEvent = new PointerEvent('pointerdown', {
        bubbles: true,
        ctrlKey: true,
        metaKey: false
      })

      handleNodeSelect(ctrlClickEvent, testNodeData)

      // On pointer down: bring to front
      expect(mockLayoutMutations.bringNodeToFront).toHaveBeenCalledWith(
        'node-1'
      )

      // But don't deselect yet (deferred to pointer up)
      expect(canvas?.deselect).not.toHaveBeenCalled()
      expect(canvas?.select).not.toHaveBeenCalled()
    })

    it('on pointer down with meta key (Cmd): brings node to front only, no selection changes', () => {
      const { handleNodeSelect } = useNodeEventHandlers()
      const { canvas } = useCanvasStore()

      mockNode!.selected = false
      mockNode!.flags.pinned = false

      const metaClickEvent = new PointerEvent('pointerdown', {
        bubbles: true,
        ctrlKey: false,
        metaKey: true
      })

      handleNodeSelect(metaClickEvent, testNodeData)

      // On pointer down with meta key: bring to front
      expect(mockLayoutMutations.bringNodeToFront).toHaveBeenCalledWith(
        'node-1'
      )

      // But don't change selection yet (deferred to pointer up)
      expect(canvas?.select).not.toHaveBeenCalled()
      expect(canvas?.deselectAll).not.toHaveBeenCalled()
      expect(canvas?.deselect).not.toHaveBeenCalled()
    })

    it('on pointer down with shift key: brings node to front only, no selection changes', () => {
      const { handleNodeSelect } = useNodeEventHandlers()
      const { canvas } = useCanvasStore()

      mockNode!.selected = false
      mockNode!.flags.pinned = false

      const shiftClickEvent = new PointerEvent('pointerdown', {
        bubbles: true,
        shiftKey: true
      })

      handleNodeSelect(shiftClickEvent, testNodeData)

      // On pointer down with shift: bring to front
      expect(mockLayoutMutations.bringNodeToFront).toHaveBeenCalledWith(
        'node-1'
      )

      // But don't change selection yet (deferred to pointer up)
      expect(canvas?.select).not.toHaveBeenCalled()
      expect(canvas?.deselectAll).not.toHaveBeenCalled()
      expect(canvas?.deselect).not.toHaveBeenCalled()
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

  describe('toggleNodeSelectionAfterPointerUp', () => {
    it('on pointer up with multi-select: selects node that was unselected at pointer down', () => {
      const { toggleNodeSelectionAfterPointerUp } = useNodeEventHandlers()
      const { canvas, updateSelectedItems } = useCanvasStore()

      mockNode!.selected = false

      toggleNodeSelectionAfterPointerUp('node-1', {
        wasSelectedAtPointerDown: false,
        multiSelect: true
      })

      expect(canvas?.select).toHaveBeenCalledWith(mockNode)
      expect(updateSelectedItems).toHaveBeenCalledOnce()
    })

    it('on pointer up with multi-select: deselects node that was selected at pointer down', () => {
      const { toggleNodeSelectionAfterPointerUp } = useNodeEventHandlers()
      const { canvas, updateSelectedItems } = useCanvasStore()

      mockNode!.selected = true

      toggleNodeSelectionAfterPointerUp('node-1', {
        wasSelectedAtPointerDown: true,
        multiSelect: true
      })

      expect(canvas?.deselect).toHaveBeenCalledWith(mockNode)
      expect(updateSelectedItems).toHaveBeenCalledOnce()
    })

    it('on pointer up without multi-select: does nothing (regular clicks handled elsewhere)', () => {
      const { toggleNodeSelectionAfterPointerUp } = useNodeEventHandlers()
      const { canvas } = useCanvasStore()

      toggleNodeSelectionAfterPointerUp('node-1', {
        wasSelectedAtPointerDown: false,
        multiSelect: false
      })

      // Regular clicks (without shift/ctrl/meta) are handled by a different code path
      // This function only handles multi-select toggle logic
      expect(canvas?.select).not.toHaveBeenCalled()
      expect(canvas?.deselect).not.toHaveBeenCalled()
    })
  })
})
