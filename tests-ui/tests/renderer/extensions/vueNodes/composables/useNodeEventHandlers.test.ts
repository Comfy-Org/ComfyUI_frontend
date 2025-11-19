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

const canvasSelectedItems = vi.hoisted(() => [] as Array<{ id?: string }>)

vi.mock('@/renderer/core/canvas/canvasStore', () => {
  const canvas: Partial<LGraphCanvas> = {
    select: vi.fn(),
    deselect: vi.fn(),
    deselectAll: vi.fn()
  }
  const updateSelectedItems = vi.fn()
  const canvasStoreInstance = {
    canvas: canvas as LGraphCanvas,
    updateSelectedItems,
    selectedItems: canvasSelectedItems
  }
  return {
    useCanvasStore: vi.fn(() => canvasStoreInstance)
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
    canvasSelectedItems.length = 0
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

    it('on pointer down with ctrl+click: selects node immediately', () => {
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

      // Selection happens immediately so dragging includes this node
      expect(canvas?.deselectAll).not.toHaveBeenCalled()
      expect(canvas?.select).toHaveBeenCalledWith(mockNode)
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

    it('on pointer down with meta key (Cmd): selects node immediately', () => {
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

      // Selection happens immediately
      expect(canvas?.select).toHaveBeenCalledWith(mockNode)
      expect(canvas?.deselectAll).not.toHaveBeenCalled()
      expect(canvas?.deselect).not.toHaveBeenCalled()
    })

    it('on pointer down with shift key: selects node immediately', () => {
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

      // Selection happens immediately for shift-click as well
      expect(canvas?.select).toHaveBeenCalledWith(mockNode)
      expect(canvas?.deselectAll).not.toHaveBeenCalled()
      expect(canvas?.deselect).not.toHaveBeenCalled()
    })

    it('keeps existing multi-selection when dragging selected node without modifiers', () => {
      const { handleNodeSelect } = useNodeEventHandlers()
      const { canvas } = useCanvasStore()

      mockNode!.selected = true
      canvasSelectedItems.push({ id: 'node-1' }, { id: 'node-2' })

      const event = new PointerEvent('pointerdown', {
        bubbles: true,
        ctrlKey: false,
        metaKey: false
      })

      handleNodeSelect(event, testNodeData)

      expect(canvas?.deselectAll).not.toHaveBeenCalled()
      expect(canvas?.select).not.toHaveBeenCalled()
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

    it('on pointer up with multi-select and node not previously selected: no-op', () => {
      const { toggleNodeSelectionAfterPointerUp } = useNodeEventHandlers()
      const { canvas, updateSelectedItems } = useCanvasStore()

      mockNode!.selected = true

      toggleNodeSelectionAfterPointerUp('node-1', {
        wasSelectedAtPointerDown: false,
        multiSelect: true
      })

      expect(canvas?.select).not.toHaveBeenCalled()
      expect(updateSelectedItems).not.toHaveBeenCalled()
    })

    it('on pointer up without multi-select: collapses multi-selection to clicked node', () => {
      const { toggleNodeSelectionAfterPointerUp } = useNodeEventHandlers()
      const { canvas, updateSelectedItems } = useCanvasStore()

      mockNode!.selected = true
      canvasSelectedItems.push({ id: 'node-1' }, { id: 'node-2' })

      toggleNodeSelectionAfterPointerUp('node-1', {
        wasSelectedAtPointerDown: true,
        multiSelect: false
      })

      expect(canvas?.deselectAll).toHaveBeenCalledOnce()
      expect(canvas?.select).toHaveBeenCalledWith(mockNode)
      expect(updateSelectedItems).toHaveBeenCalledOnce()
    })

    it('on pointer up without multi-select: keeps single selection intact', () => {
      const { toggleNodeSelectionAfterPointerUp } = useNodeEventHandlers()
      const { canvas, updateSelectedItems } = useCanvasStore()

      mockNode!.selected = true
      canvasSelectedItems.push({ id: 'node-1' })

      toggleNodeSelectionAfterPointerUp('node-1', {
        wasSelectedAtPointerDown: true,
        multiSelect: false
      })

      expect(canvas?.deselectAll).not.toHaveBeenCalled()
      expect(canvas?.select).not.toHaveBeenCalled()
      expect(updateSelectedItems).not.toHaveBeenCalled()
    })
  })

  describe('ensureNodeSelectedForShiftDrag', () => {
    it('does nothing when multi-select key is not pressed', () => {
      const { ensureNodeSelectedForShiftDrag } = useNodeEventHandlers()
      const { canvas } = useCanvasStore()

      const event = new PointerEvent('pointermove', { shiftKey: false })

      ensureNodeSelectedForShiftDrag(event, testNodeData, false)

      expect(canvas?.select).not.toHaveBeenCalled()
      expect(canvas?.deselectAll).not.toHaveBeenCalled()
    })

    it('selects node and clears existing selection when shift-dragging with no other selections', () => {
      const { ensureNodeSelectedForShiftDrag } = useNodeEventHandlers()
      const { canvas } = useCanvasStore()

      mockNode!.selected = false

      const event = new PointerEvent('pointermove', { shiftKey: true })

      ensureNodeSelectedForShiftDrag(event, testNodeData, false)

      expect(canvas?.deselectAll).toHaveBeenCalledOnce()
      expect(canvas?.select).toHaveBeenCalledWith(mockNode)
    })

    it('adds node to existing multi-selection without clearing other nodes', () => {
      const { ensureNodeSelectedForShiftDrag } = useNodeEventHandlers()
      const { canvas, selectedItems } = useCanvasStore()

      // Create mock Positionable objects for existing selection
      const mockExisting1 = {
        id: 'existing-1',
        pos: [0, 0] as [number, number],
        move: vi.fn(),
        snapToGrid: vi.fn(),
        boundingRect: vi.fn(() => [0, 0, 100, 100] as const)
      } as unknown as LGraphNode
      const mockExisting2 = {
        id: 'existing-2',
        pos: [0, 0] as [number, number],
        move: vi.fn(),
        snapToGrid: vi.fn(),
        boundingRect: vi.fn(() => [0, 0, 100, 100] as const)
      } as unknown as LGraphNode
      selectedItems.push(mockExisting1, mockExisting2)
      mockNode!.selected = false
      if (canvas?.select) vi.mocked(canvas.select).mockClear()
      if (canvas?.deselectAll) vi.mocked(canvas.deselectAll).mockClear()

      const event = new PointerEvent('pointermove', { shiftKey: true })

      ensureNodeSelectedForShiftDrag(event, testNodeData, false)

      expect(canvas?.deselectAll).not.toHaveBeenCalled()
      expect(canvas?.select).toHaveBeenCalledWith(mockNode)
    })

    it('does nothing if node is already selected (selection happened on pointer down)', () => {
      const { ensureNodeSelectedForShiftDrag } = useNodeEventHandlers()
      const { canvas } = useCanvasStore()

      mockNode!.selected = true

      const event = new PointerEvent('pointermove', { shiftKey: true })

      ensureNodeSelectedForShiftDrag(event, testNodeData, false)

      expect(canvas?.select).not.toHaveBeenCalled()
      expect(canvas?.deselectAll).not.toHaveBeenCalled()
    })
  })
})
