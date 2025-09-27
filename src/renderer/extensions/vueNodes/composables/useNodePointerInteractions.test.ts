import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { useNodePointerInteractions } from '@/renderer/extensions/vueNodes/composables/useNodePointerInteractions'
import { useNodeLayout } from '@/renderer/extensions/vueNodes/layout/useNodeLayout'

// Mock the dependencies
vi.mock('@/renderer/core/canvas/useCanvasInteractions', () => ({
  useCanvasInteractions: () => ({
    forwardEventToCanvas: vi.fn(),
    shouldHandleNodePointerEvents: ref(true)
  })
}))

// Mock the layout system
vi.mock('@/renderer/extensions/vueNodes/layout/useNodeLayout', () => ({
  useNodeLayout: vi.fn()
}))

const createBaseNodeLayoutMock = () => ({
  isDragging: ref(false),
  startDrag: vi.fn(() => true),
  endDrag: vi.fn(() => Promise.resolve()),
  handleDrag: vi.fn(),
  layoutRef: ref(null),
  position: computed(() => ({ x: 0, y: 0 })),
  size: computed(() => ({ width: 200, height: 100 })),
  bounds: computed(() => ({ x: 0, y: 0, width: 200, height: 100 })),
  isVisible: computed(() => true),
  zIndex: computed(() => 0),
  moveTo: vi.fn(),
  resize: vi.fn(),
  nodeStyle: computed(() => ({ position: 'absolute' as const }))
})
vi.mock('@/renderer/core/layout/store/layoutStore')

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
  type: string,
  overrides: Partial<PointerEvent> = {}
): PointerEvent => {
  const event = new PointerEvent(type, {
    pointerId: 1,
    clientX: 100,
    clientY: 100,
    button: 0,
    ...overrides
  })
  Object.defineProperty(event, 'target', {
    value: {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn()
    },
    writable: false
  })
  return event
}

const createMouseEvent = (
  type: string,
  overrides: Partial<MouseEvent> = {}
): MouseEvent => {
  const event = new MouseEvent(type, {
    clientX: 100,
    clientY: 100,
    button: 0,
    ...overrides
  })
  event.preventDefault = vi.fn()
  return event
}

describe('useNodePointerInteractions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('DrJKL single source of truth architecture', () => {
    it('should use useNodeLayout.isDragging as the single authority', () => {
      const mockNodeData = createMockVueNodeData()
      const mockOnPointerUp = vi.fn()

      const mockIsDragging = ref(false)
      const testMock = createBaseNodeLayoutMock()
      testMock.isDragging = mockIsDragging

      vi.mocked(useNodeLayout).mockReturnValueOnce(testMock)

      const { isDragging } = useNodePointerInteractions(
        ref(mockNodeData),
        mockOnPointerUp
      )

      expect(isDragging).toBe(mockIsDragging)
    })

    it('should eliminate coordination object entirely', () => {
      const mockNodeData = createMockVueNodeData()
      const mockOnPointerUp = vi.fn()

      vi.mocked(useNodeLayout).mockReturnValueOnce(createBaseNodeLayoutMock())

      const result = useNodePointerInteractions(
        ref(mockNodeData),
        mockOnPointerUp
      )

      expect(result.isDragging).toBeDefined()
      expect(result.pointerHandlers).toBeDefined()
      expect(result.stopWatcher).toBeDefined()
    })

    it('should use pure Vue reactivity for global state sync', async () => {
      const mockNodeData = createMockVueNodeData()
      const mockOnPointerUp = vi.fn()

      const mockStartDrag = vi.fn(() => true)
      const testMock = createBaseNodeLayoutMock()
      testMock.startDrag = mockStartDrag

      vi.mocked(useNodeLayout).mockReturnValue(testMock)

      const { pointerHandlers, isDragging } = useNodePointerInteractions(
        ref(mockNodeData),
        mockOnPointerUp
      )

      pointerHandlers.onPointerdown(createPointerEvent('pointerdown'))

      expect(mockStartDrag).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'pointerdown',
          button: 0
        })
      )

      expect(isDragging).toBe(testMock.isDragging)
    })

    it('should make startDrag return success boolean to fix race condition', () => {
      const mockNodeData = createMockVueNodeData()
      const mockOnPointerUp = vi.fn()

      const mockIsDragging = ref(false)
      const mockStartDrag = vi.fn().mockImplementation(() => {
        mockIsDragging.value = true
        return true
      })
      const testMock = createBaseNodeLayoutMock()
      testMock.isDragging = mockIsDragging
      testMock.startDrag = mockStartDrag

      vi.mocked(useNodeLayout).mockReturnValueOnce(testMock)

      const { pointerHandlers } = useNodePointerInteractions(
        ref(mockNodeData),
        mockOnPointerUp
      )

      // Test 1: startDrag should be called and return success
      pointerHandlers.onPointerdown(createPointerEvent('pointerdown'))
      expect(mockStartDrag).toHaveBeenCalled()
      expect(mockStartDrag).toHaveReturnedWith(true)

      // Reset for next test
      vi.clearAllMocks()
      mockIsDragging.value = false

      // Test 2: If startDrag fails, drag state shouldn't be set
      mockStartDrag.mockReturnValue(false)

      pointerHandlers.onPointerdown(createPointerEvent('pointerdown'))
      expect(mockStartDrag).toHaveBeenCalled()
      expect(mockIsDragging.value).toBe(false)
    })

    it('should have clean Vue-native implementation without manual sync', () => {
      const mockNodeData = createMockVueNodeData()
      const mockOnPointerUp = vi.fn()

      const mockIsDragging = ref(false)
      const testMock = createBaseNodeLayoutMock()
      testMock.isDragging = mockIsDragging

      vi.mocked(useNodeLayout).mockReturnValueOnce(testMock)

      const result = useNodePointerInteractions(
        ref(mockNodeData),
        mockOnPointerUp
      )

      expect(result.isDragging).toBeDefined()
      expect(result.pointerHandlers).toBeDefined()
      expect(result.stopWatcher).toBeDefined()

      expect(result.isDragging.value).toBe(false)
      mockIsDragging.value = true
      expect(result.isDragging.value).toBe(true)
    })
  })

  // Essential integration tests
  describe('basic functionality', () => {
    it('should only start drag on left-click', async () => {
      const mockNodeData = createMockVueNodeData()
      const mockOnPointerUp = vi.fn()

      const mockStartDrag = vi.fn()
      const testMock = createBaseNodeLayoutMock()
      testMock.startDrag = mockStartDrag

      vi.mocked(useNodeLayout).mockReturnValueOnce(testMock)

      const { pointerHandlers } = useNodePointerInteractions(
        ref(mockNodeData),
        mockOnPointerUp
      )

      // Right-click should not start drag
      const rightClick = createPointerEvent('pointerdown', { button: 2 })
      pointerHandlers.onPointerdown(rightClick)
      expect(mockStartDrag).not.toHaveBeenCalled()

      // Left-click should start drag
      const leftClick = createPointerEvent('pointerdown', { button: 0 })
      pointerHandlers.onPointerdown(leftClick)
      expect(mockStartDrag).toHaveBeenCalled()
    })

    it('should distinguish drag from click based on distance threshold', async () => {
      const mockNodeData = createMockVueNodeData()
      const mockOnPointerUp = vi.fn()

      const mockIsDragging = ref(false)
      const testMock = createBaseNodeLayoutMock()
      testMock.isDragging = mockIsDragging

      vi.mocked(useNodeLayout).mockReturnValueOnce(testMock)

      const { pointerHandlers } = useNodePointerInteractions(
        ref(mockNodeData),
        mockOnPointerUp
      )

      // Start at 100, 100
      pointerHandlers.onPointerdown(
        createPointerEvent('pointerdown', { clientX: 100, clientY: 100 })
      )

      // Move just 2 pixels (below threshold)
      pointerHandlers.onPointerup(
        createPointerEvent('pointerup', { clientX: 102, clientY: 102 })
      )

      // Should be considered a click, not drag
      expect(mockOnPointerUp).toHaveBeenCalledWith(
        expect.any(Object),
        mockNodeData,
        false // wasDragging = false
      )
    })

    it('should handle drag termination via cancel and context menu', async () => {
      const mockNodeData = createMockVueNodeData()
      const mockOnPointerUp = vi.fn()

      const mockIsDragging = ref(true)
      const testMock = createBaseNodeLayoutMock()
      testMock.isDragging = mockIsDragging

      vi.mocked(useNodeLayout).mockReturnValueOnce(testMock)

      const { pointerHandlers } = useNodePointerInteractions(
        ref(mockNodeData),
        mockOnPointerUp
      )

      const contextMenu = createMouseEvent('contextmenu')
      pointerHandlers.onContextmenu(contextMenu)

      expect(contextMenu.preventDefault).toHaveBeenCalled()
      mockIsDragging.value = false
      const contextMenuNotDragging = createMouseEvent('contextmenu')
      pointerHandlers.onContextmenu(contextMenuNotDragging)

      expect(contextMenuNotDragging.preventDefault).not.toHaveBeenCalled()
    })

    it('should not emit callback when nodeData becomes null', async () => {
      const mockOnPointerUp = vi.fn()

      const mockIsDragging = ref(false)
      const testMock = createBaseNodeLayoutMock()
      testMock.isDragging = mockIsDragging

      vi.mocked(useNodeLayout).mockReturnValueOnce(testMock)

      // Start with null nodeData
      const { pointerHandlers } = useNodePointerInteractions(
        ref(null),
        mockOnPointerUp
      )

      // Should not crash or call callback
      pointerHandlers.onPointerdown(createPointerEvent('pointerdown'))
      pointerHandlers.onPointerup(createPointerEvent('pointerup'))

      expect(mockOnPointerUp).not.toHaveBeenCalled()
    })
  })
})
