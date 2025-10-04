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
  beforeEach(() => {
    vi.clearAllMocks()
    forwardEventToCanvasMock.mockClear()
  })

  it('should only start drag on left-click', async () => {
    const mockNodeData = createMockVueNodeData()
    const mockOnPointerUp = vi.fn()

    const { pointerHandlers } = useNodePointerInteractions(
      ref(mockNodeData),
      mockOnPointerUp
    )

    // Right-click should not start drag
    const rightClickEvent = createPointerEvent('pointerdown', { button: 2 })
    pointerHandlers.onPointerdown(rightClickEvent)

    expect(mockOnPointerUp).not.toHaveBeenCalled()

    // Left-click should start drag and emit callback
    const leftClickEvent = createPointerEvent('pointerdown', { button: 0 })
    pointerHandlers.onPointerdown(leftClickEvent)

    const pointerUpEvent = createPointerEvent('pointerup')
    pointerHandlers.onPointerup(pointerUpEvent)

    expect(mockOnPointerUp).toHaveBeenCalledWith(
      pointerUpEvent,
      mockNodeData,
      false // wasDragging = false (same position)
    )
  })

  it('forwards middle mouse interactions to the canvas', () => {
    const mockNodeData = createMockVueNodeData()
    const mockOnPointerUp = vi.fn()

    const { pointerHandlers } = useNodePointerInteractions(
      ref(mockNodeData),
      mockOnPointerUp
    )

    const middlePointerDown = createPointerEvent('pointerdown', { button: 1 })
    pointerHandlers.onPointerdown(middlePointerDown)
    expect(forwardEventToCanvasMock).toHaveBeenCalledWith(middlePointerDown)

    forwardEventToCanvasMock.mockClear()

    const middlePointerMove = createPointerEvent('pointermove', { buttons: 4 })
    pointerHandlers.onPointermove(middlePointerMove)
    expect(forwardEventToCanvasMock).toHaveBeenCalledWith(middlePointerMove)

    forwardEventToCanvasMock.mockClear()

    const middlePointerUp = createPointerEvent('pointerup', { button: 1 })
    pointerHandlers.onPointerup(middlePointerUp)
    expect(forwardEventToCanvasMock).toHaveBeenCalledWith(middlePointerUp)

    expect(mockOnPointerUp).not.toHaveBeenCalled()
  })

  it('forwards middle mouse events during capture phase', () => {
    const mockNodeData = createMockVueNodeData()
    const mockOnPointerUp = vi.fn()

    const { pointerHandlers } = useNodePointerInteractions(
      ref(mockNodeData),
      mockOnPointerUp
    )

    const middlePointerDown = createPointerEvent('pointerdown', { button: 1 })
    pointerHandlers.onPointerdownCapture?.(middlePointerDown)
    expect(forwardEventToCanvasMock).toHaveBeenCalledWith(middlePointerDown)

    forwardEventToCanvasMock.mockClear()

    const middlePointerMove = createPointerEvent('pointermove', { buttons: 4 })
    pointerHandlers.onPointermoveCapture?.(middlePointerMove)
    expect(forwardEventToCanvasMock).toHaveBeenCalledWith(middlePointerMove)

    forwardEventToCanvasMock.mockClear()

    const middlePointerUp = createPointerEvent('pointerup', { button: 1 })
    pointerHandlers.onPointerupCapture?.(middlePointerUp)
    expect(forwardEventToCanvasMock).toHaveBeenCalledWith(middlePointerUp)
  })

  it('should distinguish drag from click based on distance threshold', async () => {
    const mockNodeData = createMockVueNodeData()
    const mockOnPointerUp = vi.fn()

    const { pointerHandlers } = useNodePointerInteractions(
      ref(mockNodeData),
      mockOnPointerUp
    )

    // Test drag (distance > 4px)
    pointerHandlers.onPointerdown(
      createPointerEvent('pointerdown', { clientX: 100, clientY: 100 })
    )

    const dragUpEvent = createPointerEvent('pointerup', {
      clientX: 200,
      clientY: 200
    })
    pointerHandlers.onPointerup(dragUpEvent)

    expect(mockOnPointerUp).toHaveBeenCalledWith(
      dragUpEvent,
      mockNodeData,
      true
    )

    mockOnPointerUp.mockClear()

    // Test click (same position)
    const samePos = { clientX: 100, clientY: 100 }
    pointerHandlers.onPointerdown(createPointerEvent('pointerdown', samePos))

    const clickUpEvent = createPointerEvent('pointerup', samePos)
    pointerHandlers.onPointerup(clickUpEvent)

    expect(mockOnPointerUp).toHaveBeenCalledWith(
      clickUpEvent,
      mockNodeData,
      false
    )
  })

  it('should handle drag termination via cancel and context menu', async () => {
    const mockNodeData = createMockVueNodeData()
    const mockOnPointerUp = vi.fn()

    const { pointerHandlers } = useNodePointerInteractions(
      ref(mockNodeData),
      mockOnPointerUp
    )

    // Test pointer cancel
    pointerHandlers.onPointerdown(createPointerEvent('pointerdown'))
    pointerHandlers.onPointercancel(createPointerEvent('pointercancel'))

    // Should not emit callback on cancel
    expect(mockOnPointerUp).not.toHaveBeenCalled()

    // Test context menu during drag prevents default
    pointerHandlers.onPointerdown(createPointerEvent('pointerdown'))

    const contextMenuEvent = createMouseEvent('contextmenu')
    const preventDefaultSpy = vi.spyOn(contextMenuEvent, 'preventDefault')

    pointerHandlers.onContextmenu(contextMenuEvent)

    expect(preventDefaultSpy).toHaveBeenCalled()
  })

  it('should not emit callback when nodeData becomes null', async () => {
    const mockNodeData = createMockVueNodeData()
    const mockOnPointerUp = vi.fn()
    const nodeDataRef = ref<VueNodeData | null>(mockNodeData)

    const { pointerHandlers } = useNodePointerInteractions(
      nodeDataRef,
      mockOnPointerUp
    )

    pointerHandlers.onPointerdown(createPointerEvent('pointerdown'))

    // Clear nodeData before pointerup
    nodeDataRef.value = null

    pointerHandlers.onPointerup(createPointerEvent('pointerup'))

    expect(mockOnPointerUp).not.toHaveBeenCalled()
  })

  it('should integrate with layout store dragging state', async () => {
    const mockNodeData = createMockVueNodeData()
    const mockOnPointerUp = vi.fn()
    const { layoutStore } = await import(
      '@/renderer/core/layout/store/layoutStore'
    )

    const { pointerHandlers } = useNodePointerInteractions(
      ref(mockNodeData),
      mockOnPointerUp
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
})
