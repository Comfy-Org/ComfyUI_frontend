import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { useNodePointerInteractions } from '@/renderer/extensions/vueNodes/composables/useNodePointerInteractions'

const forwardEventToCanvasMock = vi.fn()

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
    // Reset layout store state between tests
    const { layoutStore } = await import(
      '@/renderer/core/layout/store/layoutStore'
    )
    layoutStore.isDraggingVueNodes.value = false
  })

  it('should only start drag on left-click', async () => {
    const mockNodeData = createMockVueNodeData()
    const mockOnNodeSelect = vi.fn()

    const { pointerHandlers } = useNodePointerInteractions(
      ref(mockNodeData),
      mockOnNodeSelect
    )

    // Right-click should not trigger selection
    const rightClickEvent = createPointerEvent('pointerdown', { button: 2 })
    pointerHandlers.onPointerdown(rightClickEvent)

    expect(mockOnNodeSelect).not.toHaveBeenCalled()

    // Left-click should trigger selection on pointer down
    const leftClickEvent = createPointerEvent('pointerdown', { button: 0 })
    pointerHandlers.onPointerdown(leftClickEvent)

    expect(mockOnNodeSelect).toHaveBeenCalledWith(leftClickEvent, mockNodeData)
  })

  it('should call onNodeSelect on pointer down', async () => {
    const mockNodeData = createMockVueNodeData()
    const mockOnNodeSelect = vi.fn()

    const { pointerHandlers } = useNodePointerInteractions(
      ref(mockNodeData),
      mockOnNodeSelect
    )

    // Selection should happen on pointer down
    const downEvent = createPointerEvent('pointerdown', {
      clientX: 100,
      clientY: 100
    })
    pointerHandlers.onPointerdown(downEvent)

    expect(mockOnNodeSelect).toHaveBeenCalledWith(downEvent, mockNodeData)

    mockOnNodeSelect.mockClear()

    // Even if we drag, selection already happened on pointer down
    pointerHandlers.onPointerup(
      createPointerEvent('pointerup', { clientX: 200, clientY: 200 })
    )

    // onNodeSelect should not be called again on pointer up
    expect(mockOnNodeSelect).not.toHaveBeenCalled()
  })

  it('should handle drag termination via cancel and context menu', async () => {
    const mockNodeData = createMockVueNodeData()
    const mockOnNodeSelect = vi.fn()

    const { pointerHandlers } = useNodePointerInteractions(
      ref(mockNodeData),
      mockOnNodeSelect
    )

    // Test pointer cancel - selection happens on pointer down
    pointerHandlers.onPointerdown(createPointerEvent('pointerdown'))
    expect(mockOnNodeSelect).toHaveBeenCalledTimes(1)

    pointerHandlers.onPointercancel(createPointerEvent('pointercancel'))

    // Selection should have been called on pointer down only
    expect(mockOnNodeSelect).toHaveBeenCalledTimes(1)

    mockOnNodeSelect.mockClear()

    // Test context menu during drag prevents default
    pointerHandlers.onPointerdown(createPointerEvent('pointerdown'))

    const contextMenuEvent = createMouseEvent('contextmenu')
    const preventDefaultSpy = vi.spyOn(contextMenuEvent, 'preventDefault')

    pointerHandlers.onContextmenu(contextMenuEvent)

    expect(preventDefaultSpy).toHaveBeenCalled()
  })

  it('should not call onNodeSelect when nodeData is null', async () => {
    const mockNodeData = createMockVueNodeData()
    const mockOnNodeSelect = vi.fn()
    const nodeDataRef = ref<VueNodeData | null>(mockNodeData)

    const { pointerHandlers } = useNodePointerInteractions(
      nodeDataRef,
      mockOnNodeSelect
    )

    // Clear nodeData before pointer down
    nodeDataRef.value = null
    await nextTick()

    pointerHandlers.onPointerdown(createPointerEvent('pointerdown'))

    expect(mockOnNodeSelect).not.toHaveBeenCalled()
  })

  it('should integrate with layout store dragging state', async () => {
    const mockNodeData = createMockVueNodeData()
    const mockOnNodeSelect = vi.fn()
    const { layoutStore } = await import(
      '@/renderer/core/layout/store/layoutStore'
    )

    const { pointerHandlers } = useNodePointerInteractions(
      ref(mockNodeData),
      mockOnNodeSelect
    )

    // Start drag
    pointerHandlers.onPointerdown(createPointerEvent('pointerdown'))
    await nextTick()
    expect(layoutStore.isDraggingVueNodes.value).toBe(true)

    // End drag
    pointerHandlers.onPointercancel(createPointerEvent('pointercancel'))
    await nextTick()
    expect(layoutStore.isDraggingVueNodes.value).toBe(false)
  })

  it('should select node on pointer down with ctrl key for multi-select', async () => {
    const mockNodeData = createMockVueNodeData()
    const mockOnNodeSelect = vi.fn()

    const { pointerHandlers } = useNodePointerInteractions(
      ref(mockNodeData),
      mockOnNodeSelect
    )

    // Pointer down with ctrl key should pass the event with ctrl key set
    const ctrlDownEvent = createPointerEvent('pointerdown', {
      ctrlKey: true,
      clientX: 100,
      clientY: 100
    })
    pointerHandlers.onPointerdown(ctrlDownEvent)

    expect(mockOnNodeSelect).toHaveBeenCalledWith(ctrlDownEvent, mockNodeData)
    expect(mockOnNodeSelect).toHaveBeenCalledTimes(1)
  })

  it('should select pinned node on pointer down but not start drag', async () => {
    const mockNodeData = createMockVueNodeData({
      flags: { pinned: true }
    })
    const mockOnNodeSelect = vi.fn()
    const { layoutStore } = await import(
      '@/renderer/core/layout/store/layoutStore'
    )

    const { pointerHandlers } = useNodePointerInteractions(
      ref(mockNodeData),
      mockOnNodeSelect
    )

    // Pointer down on pinned node
    const downEvent = createPointerEvent('pointerdown')
    pointerHandlers.onPointerdown(downEvent)

    // Should select the node
    expect(mockOnNodeSelect).toHaveBeenCalledWith(downEvent, mockNodeData)

    // But should not start dragging
    expect(layoutStore.isDraggingVueNodes.value).toBe(false)
  })

  it('should select node immediately when drag starts', async () => {
    const mockNodeData = createMockVueNodeData()
    const mockOnNodeSelect = vi.fn()
    const { layoutStore } = await import(
      '@/renderer/core/layout/store/layoutStore'
    )

    const { pointerHandlers } = useNodePointerInteractions(
      ref(mockNodeData),
      mockOnNodeSelect
    )

    // Pointer down should select node immediately
    const downEvent = createPointerEvent('pointerdown', {
      clientX: 100,
      clientY: 100
    })
    pointerHandlers.onPointerdown(downEvent)

    // Selection should happen on pointer down (before move)
    expect(mockOnNodeSelect).toHaveBeenCalledWith(downEvent, mockNodeData)
    expect(mockOnNodeSelect).toHaveBeenCalledTimes(1)

    // Dragging state should be active
    expect(layoutStore.isDraggingVueNodes.value).toBe(true)

    // Move the pointer (start dragging)
    pointerHandlers.onPointermove(
      createPointerEvent('pointermove', { clientX: 150, clientY: 150 })
    )

    // Selection should still only have been called once (on pointer down)
    expect(mockOnNodeSelect).toHaveBeenCalledTimes(1)

    // End drag
    pointerHandlers.onPointerup(
      createPointerEvent('pointerup', { clientX: 150, clientY: 150 })
    )

    // Selection should still only have been called once
    expect(mockOnNodeSelect).toHaveBeenCalledTimes(1)
  })
})
