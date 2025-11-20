import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { useNodePointerInteractions } from '@/renderer/extensions/vueNodes/composables/useNodePointerInteractions'
import { useNodeEventHandlers } from '@/renderer/extensions/vueNodes/composables/useNodeEventHandlers'

const forwardEventToCanvasMock = vi.fn()
const selectedItemsState: { items: Array<{ id?: string }> } = { items: [] }

// Mock the dependencies
vi.mock('@/renderer/core/canvas/useCanvasInteractions', () => ({
  useCanvasInteractions: () => ({
    forwardEventToCanvas: forwardEventToCanvasMock,
    shouldHandleNodePointerEvents: ref(true)
  })
}))

vi.mock('@/renderer/extensions/vueNodes/layout/useNodeLayout', () => ({
  useNodeLayout: () => ({
    startDrag: vi.fn(),
    endDrag: vi.fn().mockResolvedValue(undefined),
    handleDrag: vi.fn().mockResolvedValue(undefined)
  })
}))

vi.mock('@/renderer/core/layout/store/layoutStore', () => ({
  layoutStore: {
    isDraggingVueNodes: ref(false)
  }
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    get selectedItems() {
      return selectedItemsState.items
    }
  })
}))

vi.mock(
  '@/renderer/extensions/vueNodes/composables/useNodeEventHandlers',
  () => {
    const handleNodeSelect = vi.fn()
    const deselectNode = vi.fn()
    const selectNodes = vi.fn()
    const toggleNodeSelectionAfterPointerUp = vi.fn()
    const ensureNodeSelectedForShiftDrag = vi.fn()

    return {
      useNodeEventHandlers: () => ({
        handleNodeSelect,
        deselectNode,
        selectNodes,
        toggleNodeSelectionAfterPointerUp,
        ensureNodeSelectedForShiftDrag
      })
    }
  }
)

vi.mock('@/composables/graph/useVueNodeLifecycle', () => ({
  useVueNodeLifecycle: () => ({
    nodeManager: ref({
      getNode: vi.fn((id: string) => ({
        id,
        selected: false // Default to not selected
      }))
    })
  })
}))

const createMockVueNodeData = (
  overrides: Partial<VueNodeData> = {}
): VueNodeData => ({
  id: 'test-node-123',
  title: 'Test Node',
  type: 'TestNodeType',
  mode: 0,
  selected: false,
  executing: false,
  inputs: [],
  outputs: [],
  widgets: [],
  ...overrides
})

const createPointerEvent = (
  eventType: string,
  overrides: Partial<PointerEventInit> = {}
): PointerEvent => {
  return new PointerEvent(eventType, {
    pointerId: 1,
    button: 0,
    clientX: 100,
    clientY: 100,
    ...overrides
  })
}

const createMouseEvent = (
  eventType: string,
  overrides: Partial<MouseEventInit> = {}
): MouseEvent => {
  return new MouseEvent(eventType, {
    button: 2, // Right click
    clientX: 100,
    clientY: 100,
    ...overrides
  })
}

describe('useNodePointerInteractions', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    selectedItemsState.items = []
    setActivePinia(createPinia())
    // Reset layout store state between tests
    const { layoutStore } = await import(
      '@/renderer/core/layout/store/layoutStore'
    )
    layoutStore.isDraggingVueNodes.value = false
  })

  it('should only start drag on left-click', async () => {
    const mockNodeData = createMockVueNodeData()
    const { handleNodeSelect } = useNodeEventHandlers()

    const { pointerHandlers } = useNodePointerInteractions(ref(mockNodeData))

    // Right-click should not trigger selection
    const rightClickEvent = createPointerEvent('pointerdown', { button: 2 })
    pointerHandlers.onPointerdown(rightClickEvent)

    expect(handleNodeSelect).not.toHaveBeenCalled()

    // Left-click should trigger selection on pointer down
    const leftClickEvent = createPointerEvent('pointerdown', { button: 0 })
    pointerHandlers.onPointerdown(leftClickEvent)

    expect(handleNodeSelect).toHaveBeenCalledWith(leftClickEvent, mockNodeData)
  })

  it('should call onNodeSelect on pointer down', async () => {
    const mockNodeData = createMockVueNodeData()
    const { handleNodeSelect } = useNodeEventHandlers()

    const { pointerHandlers } = useNodePointerInteractions(ref(mockNodeData))

    // Selection should happen on pointer down
    const downEvent = createPointerEvent('pointerdown', {
      clientX: 100,
      clientY: 100
    })
    pointerHandlers.onPointerdown(downEvent)

    expect(handleNodeSelect).toHaveBeenCalledWith(downEvent, mockNodeData)

    vi.mocked(handleNodeSelect).mockClear()

    // Even if we drag, selection already happened on pointer down
    pointerHandlers.onPointerup(
      createPointerEvent('pointerup', { clientX: 200, clientY: 200 })
    )

    // onNodeSelect should not be called again on pointer up
    expect(handleNodeSelect).not.toHaveBeenCalled()
  })

  it('should handle drag termination via cancel and context menu', async () => {
    const mockNodeData = createMockVueNodeData()
    const { handleNodeSelect } = useNodeEventHandlers()

    const { pointerHandlers } = useNodePointerInteractions(ref(mockNodeData))

    // Test pointer cancel - selection happens on pointer down
    pointerHandlers.onPointerdown(
      createPointerEvent('pointerdown', { clientX: 100, clientY: 100 })
    )
    expect(handleNodeSelect).toHaveBeenCalledTimes(1)

    // Simulate drag by moving pointer beyond threshold
    pointerHandlers.onPointermove(
      createPointerEvent('pointermove', { clientX: 110, clientY: 110 })
    )

    pointerHandlers.onPointercancel(createPointerEvent('pointercancel'))

    // Selection should have been called on pointer down only
    expect(handleNodeSelect).toHaveBeenCalledTimes(1)

    vi.mocked(handleNodeSelect).mockClear()

    // Test context menu during drag prevents default
    pointerHandlers.onPointerdown(
      createPointerEvent('pointerdown', { clientX: 100, clientY: 100 })
    )
    // Simulate drag by moving pointer beyond threshold
    pointerHandlers.onPointermove(
      createPointerEvent('pointermove', { clientX: 110, clientY: 110 })
    )

    const contextMenuEvent = createMouseEvent('contextmenu')
    const preventDefaultSpy = vi.spyOn(contextMenuEvent, 'preventDefault')

    pointerHandlers.onContextmenu(contextMenuEvent)

    expect(preventDefaultSpy).toHaveBeenCalled()
  })

  it('should not call onNodeSelect when nodeData is null', async () => {
    const mockNodeData = createMockVueNodeData()
    const nodeDataRef = ref<VueNodeData | null>(mockNodeData)
    const { handleNodeSelect } = useNodeEventHandlers()

    const { pointerHandlers } = useNodePointerInteractions(nodeDataRef)

    // Clear nodeData before pointer down
    nodeDataRef.value = null
    await nextTick()

    pointerHandlers.onPointerdown(createPointerEvent('pointerdown'))

    expect(handleNodeSelect).not.toHaveBeenCalled()
  })

  it('should integrate with layout store dragging state', async () => {
    const mockNodeData = createMockVueNodeData()
    const { layoutStore } = await import(
      '@/renderer/core/layout/store/layoutStore'
    )

    const { pointerHandlers } = useNodePointerInteractions(ref(mockNodeData))

    // Pointer down alone shouldn't set dragging state
    pointerHandlers.onPointerdown(
      createPointerEvent('pointerdown', { clientX: 100, clientY: 100 })
    )
    expect(layoutStore.isDraggingVueNodes.value).toBe(false)

    // Move pointer beyond threshold to start drag
    pointerHandlers.onPointermove(
      createPointerEvent('pointermove', { clientX: 110, clientY: 110 })
    )
    await nextTick()
    expect(layoutStore.isDraggingVueNodes.value).toBe(true)

    // End drag
    pointerHandlers.onPointercancel(createPointerEvent('pointercancel'))
    await nextTick()
    expect(layoutStore.isDraggingVueNodes.value).toBe(false)
  })

  it('should select node on pointer down with ctrl key for multi-select', async () => {
    const mockNodeData = createMockVueNodeData()
    const { handleNodeSelect } = useNodeEventHandlers()

    const { pointerHandlers } = useNodePointerInteractions(ref(mockNodeData))

    // Pointer down with ctrl key should pass the event with ctrl key set
    const ctrlDownEvent = createPointerEvent('pointerdown', {
      ctrlKey: true,
      clientX: 100,
      clientY: 100
    })
    pointerHandlers.onPointerdown(ctrlDownEvent)

    expect(handleNodeSelect).toHaveBeenCalledWith(ctrlDownEvent, mockNodeData)
    expect(handleNodeSelect).toHaveBeenCalledTimes(1)
  })

  it('should select pinned node on pointer down but not start drag', async () => {
    const mockNodeData = createMockVueNodeData({
      flags: { pinned: true }
    })
    const { layoutStore } = await import(
      '@/renderer/core/layout/store/layoutStore'
    )
    const { handleNodeSelect } = useNodeEventHandlers()

    const { pointerHandlers } = useNodePointerInteractions(ref(mockNodeData))

    // Pointer down on pinned node
    const downEvent = createPointerEvent('pointerdown')
    pointerHandlers.onPointerdown(downEvent)

    // Should select the node
    expect(handleNodeSelect).toHaveBeenCalledWith(downEvent, mockNodeData)

    // But should not start dragging
    expect(layoutStore.isDraggingVueNodes.value).toBe(false)
  })

  it('should select node immediately when drag starts', async () => {
    const mockNodeData = createMockVueNodeData()
    const { layoutStore } = await import(
      '@/renderer/core/layout/store/layoutStore'
    )

    const { pointerHandlers } = useNodePointerInteractions(ref(mockNodeData))

    // Pointer down should select node immediately
    const downEvent = createPointerEvent('pointerdown', {
      clientX: 100,
      clientY: 100
    })
    pointerHandlers.onPointerdown(downEvent)
    const { handleNodeSelect } = useNodeEventHandlers()

    // Selection should happen on pointer down (before move)
    expect(handleNodeSelect).toHaveBeenCalledWith(downEvent, mockNodeData)
    expect(handleNodeSelect).toHaveBeenCalledTimes(1)

    // Dragging state should NOT be active yet
    expect(layoutStore.isDraggingVueNodes.value).toBe(false)

    // Move the pointer beyond threshold (start dragging)
    pointerHandlers.onPointermove(
      createPointerEvent('pointermove', { clientX: 150, clientY: 150 })
    )

    // Now dragging state should be active
    expect(layoutStore.isDraggingVueNodes.value).toBe(true)

    // Selection should still only have been called once (on pointer down)
    expect(handleNodeSelect).toHaveBeenCalledTimes(1)

    // End drag
    pointerHandlers.onPointerup(
      createPointerEvent('pointerup', { clientX: 150, clientY: 150 })
    )

    // Selection should still only have been called once
    expect(handleNodeSelect).toHaveBeenCalledTimes(1)
  })

  it('on ctrl+click: calls toggleNodeSelectionAfterPointerUp on pointer up (not pointer down)', async () => {
    const mockNodeData = createMockVueNodeData()

    const { pointerHandlers } = useNodePointerInteractions(ref(mockNodeData))
    const { toggleNodeSelectionAfterPointerUp } = useNodeEventHandlers()

    // Pointer down with ctrl
    const downEvent = createPointerEvent('pointerdown', {
      ctrlKey: true,
      clientX: 100,
      clientY: 100
    })
    pointerHandlers.onPointerdown(downEvent)

    // On pointer down: toggle handler should NOT be called yet
    expect(toggleNodeSelectionAfterPointerUp).not.toHaveBeenCalled()

    // Pointer up with ctrl (no drag - same position)
    const upEvent = createPointerEvent('pointerup', {
      ctrlKey: true,
      clientX: 100,
      clientY: 100
    })
    pointerHandlers.onPointerup(upEvent)

    // On pointer up: toggle handler IS called with correct params
    expect(toggleNodeSelectionAfterPointerUp).toHaveBeenCalledWith(
      mockNodeData.id,
      {
        wasSelectedAtPointerDown: false,
        multiSelect: true
      }
    )
  })

  it('on ctrl+drag: does NOT call toggleNodeSelectionAfterPointerUp', async () => {
    const mockNodeData = createMockVueNodeData()
    const { toggleNodeSelectionAfterPointerUp } = useNodeEventHandlers()

    const { pointerHandlers } = useNodePointerInteractions(ref(mockNodeData))

    // Pointer down with ctrl
    const downEvent = createPointerEvent('pointerdown', {
      ctrlKey: true,
      clientX: 100,
      clientY: 100
    })
    pointerHandlers.onPointerdown(downEvent)

    // Move beyond drag threshold
    pointerHandlers.onPointermove(
      createPointerEvent('pointermove', {
        ctrlKey: true,
        clientX: 110,
        clientY: 110
      })
    )

    // Pointer up after drag
    const upEvent = createPointerEvent('pointerup', {
      ctrlKey: true,
      clientX: 110,
      clientY: 110
    })
    pointerHandlers.onPointerup(upEvent)

    // When dragging: toggle handler should NOT be called
    expect(toggleNodeSelectionAfterPointerUp).not.toHaveBeenCalled()
  })
})
