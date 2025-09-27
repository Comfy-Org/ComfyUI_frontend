import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { useNodePointerInteractions } from '@/renderer/extensions/vueNodes/composables/useNodePointerInteractions'

// Mock the dependencies
vi.mock('@/renderer/core/canvas/useCanvasInteractions', () => ({
  useCanvasInteractions: () => ({
    forwardEventToCanvas: vi.fn(),
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
  let mockNodeData: VueNodeData
  let mockOnPointerUp: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockNodeData = createMockVueNodeData()
    mockOnPointerUp = vi.fn()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should only start drag on left-click', async () => {
    const { pointerHandlers } = useNodePointerInteractions(
      ref(mockNodeData),
      mockOnPointerUp
    )

    // Right-click should not start drag
    const rightClickEvent = createPointerEvent('pointerdown', { button: 2 })
    pointerHandlers.onPointerdown(rightClickEvent)
    await nextTick()

    expect(mockOnPointerUp).not.toHaveBeenCalled()

    // Left-click should start drag and emit callback
    const leftClickEvent = createPointerEvent('pointerdown', { button: 0 })
    pointerHandlers.onPointerdown(leftClickEvent)
    await nextTick()

    const pointerUpEvent = createPointerEvent('pointerup')
    pointerHandlers.onPointerup(pointerUpEvent)
    await nextTick()

    expect(mockOnPointerUp).toHaveBeenCalledWith(
      pointerUpEvent,
      mockNodeData,
      false // wasDragging = false (same position)
    )
  })

  it('should distinguish drag from click based on distance threshold', async () => {
    const { pointerHandlers } = useNodePointerInteractions(
      ref(mockNodeData),
      mockOnPointerUp
    )

    // Test drag (distance > 4px)
    pointerHandlers.onPointerdown(
      createPointerEvent('pointerdown', { clientX: 100, clientY: 100 })
    )
    await nextTick()

    const dragUpEvent = createPointerEvent('pointerup', {
      clientX: 200,
      clientY: 200
    })
    pointerHandlers.onPointerup(dragUpEvent)
    await nextTick()

    expect(mockOnPointerUp).toHaveBeenCalledWith(
      dragUpEvent,
      mockNodeData,
      true
    )

    mockOnPointerUp.mockClear()

    // Test click (same position)
    const samePos = { clientX: 100, clientY: 100 }
    pointerHandlers.onPointerdown(createPointerEvent('pointerdown', samePos))
    await nextTick()

    const clickUpEvent = createPointerEvent('pointerup', samePos)
    pointerHandlers.onPointerup(clickUpEvent)
    await nextTick()

    expect(mockOnPointerUp).toHaveBeenCalledWith(
      clickUpEvent,
      mockNodeData,
      false
    )
  })

  it('should handle drag termination via cancel and context menu', async () => {
    const { pointerHandlers } = useNodePointerInteractions(
      ref(mockNodeData),
      mockOnPointerUp
    )

    // Test pointer cancel
    pointerHandlers.onPointerdown(createPointerEvent('pointerdown'))
    await nextTick()
    pointerHandlers.onPointercancel(createPointerEvent('pointercancel'))
    await nextTick()

    // Should not emit callback on cancel
    expect(mockOnPointerUp).not.toHaveBeenCalled()

    // Test context menu during drag prevents default
    pointerHandlers.onPointerdown(createPointerEvent('pointerdown'))
    await nextTick()

    const contextMenuEvent = createMouseEvent('contextmenu')
    const preventDefaultSpy = vi.spyOn(contextMenuEvent, 'preventDefault')

    pointerHandlers.onContextmenu(contextMenuEvent)
    await nextTick()

    expect(preventDefaultSpy).toHaveBeenCalled()
  })

  it('should not emit callback when nodeData becomes null', async () => {
    const nodeDataRef = ref<VueNodeData | null>(mockNodeData)
    const { pointerHandlers } = useNodePointerInteractions(
      nodeDataRef,
      mockOnPointerUp
    )

    pointerHandlers.onPointerdown(createPointerEvent('pointerdown'))
    await nextTick()

    // Clear nodeData before pointerup
    nodeDataRef.value = null
    await nextTick()

    pointerHandlers.onPointerup(createPointerEvent('pointerup'))
    await nextTick()

    expect(mockOnPointerUp).not.toHaveBeenCalled()
  })

  it('should integrate with layout store dragging state', async () => {
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
