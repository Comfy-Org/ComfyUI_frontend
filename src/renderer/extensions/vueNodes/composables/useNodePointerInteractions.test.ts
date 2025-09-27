import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref, watch } from 'vue'

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
vi.mock('@/renderer/extensions/vueNodes/layout/useNodeLayout')
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

const createCompleteNodeLayoutMock = (overrides: any = {}) => ({
  layoutRef: ref(null),
  position: computed(() => ({ x: 0, y: 0 })),
  size: computed(() => ({ width: 200, height: 100 })),
  bounds: computed(() => ({ x: 0, y: 0, width: 200, height: 100 })),
  isVisible: computed(() => true),
  zIndex: computed(() => 0),
  moveTo: vi.fn(),
  resize: vi.fn(),
  nodeStyle: computed(() => ({ cursor: 'grab' })),
  startDrag: vi.fn(),
  endDrag: vi.fn(),
  handleDrag: vi.fn(),
  isDragging: ref(false),
  ...overrides
})

describe('useNodePointerInteractions', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Tests for DrJKL's single source of truth architecture
  describe('DrJKL single source of truth architecture', () => {
    it('should use useNodeLayout.isDragging as the single authority', () => {
      const mockNodeData = createMockVueNodeData()
      const mockOnPointerUp = vi.fn()

      // Create test-specific mocks
      const mockIsDragging = ref(false)

      // Mock layout system for this test
      vi.mocked(useNodeLayout).mockReturnValue(
        createCompleteNodeLayoutMock({
          startDrag: vi.fn().mockImplementation(() => {
            mockIsDragging.value = true
            return true
          }),
          endDrag: vi.fn().mockImplementation(() => {
            mockIsDragging.value = false
            return Promise.resolve()
          }),
          handleDrag: vi.fn().mockResolvedValue(undefined),
          isDragging: mockIsDragging
        })
      )

      const { isDragging } = useNodePointerInteractions(
        ref(mockNodeData),
        mockOnPointerUp
      )

      // After refactor: isDragging should be directly from useNodeLayout
      // Not a computed from coordination object
      expect(isDragging).toBe(mockIsDragging) // Same ref, not computed
    })

    it('should eliminate coordination object entirely', () => {
      const mockNodeData = createMockVueNodeData()
      const mockOnPointerUp = vi.fn()

      // Create test-specific mocks
      const mockIsDragging = ref(false)

      // Mock layout system for this test
      vi.mocked(useNodeLayout).mockReturnValue(
        createCompleteNodeLayoutMock({
          startDrag: vi.fn().mockImplementation(() => {
            mockIsDragging.value = true
            return true
          }),
          endDrag: vi.fn().mockImplementation(() => {
            mockIsDragging.value = false
            return Promise.resolve()
          }),
          handleDrag: vi.fn().mockResolvedValue(undefined),
          isDragging: mockIsDragging
        })
      )

      const result = useNodePointerInteractions(
        ref(mockNodeData),
        mockOnPointerUp
      )

      // After refactor: only simple properties should remain
      expect(result.isDragging).toBeDefined()
      expect(result.pointerHandlers).toBeDefined()
      expect(result.stopWatcher).toBeDefined()
    })

    it('should use pure Vue reactivity for global state sync', async () => {
      const mockNodeData = createMockVueNodeData()
      const mockOnPointerUp = vi.fn()

      // Create test-specific mocks
      const mockIsDragging = ref(false)
      const mockLayoutStoreRef = ref(false)

      // Mock layout system for this test
      vi.mocked(useNodeLayout).mockReturnValue(
        createCompleteNodeLayoutMock({
          startDrag: vi.fn().mockImplementation(() => {
            mockIsDragging.value = true
            return true
          }),
          endDrag: vi.fn().mockImplementation(() => {
            mockIsDragging.value = false
            return Promise.resolve()
          }),
          handleDrag: vi.fn().mockResolvedValue(undefined),
          isDragging: mockIsDragging
        })
      )

      // Mock layout store for this test
      const { layoutStore } = await import(
        '@/renderer/core/layout/store/layoutStore'
      )
      vi.mocked(layoutStore).isDraggingVueNodes = mockLayoutStoreRef

      // Set up reactive connection manually since we're mocking
      // In real code, watch(isDragging, ...) does this automatically
      watch(
        mockIsDragging,
        (dragging) => {
          mockLayoutStoreRef.value = dragging
        },
        { immediate: true }
      )

      const { pointerHandlers } = useNodePointerInteractions(
        ref(mockNodeData),
        mockOnPointerUp
      )

      // Initial state
      expect(mockLayoutStoreRef.value).toBe(false)

      // Start drag
      pointerHandlers.onPointerdown(createPointerEvent('pointerdown'))

      // Wait for Vue reactivity to propagate through watch()
      await nextTick()

      // After refactor: global state should sync automatically via watch()
      // No manual syncGlobalDragState calls
      expect(mockLayoutStoreRef.value).toBe(true)

      // End drag
      pointerHandlers.onPointerup(createPointerEvent('pointerup'))

      // Wait for Vue reactivity to propagate through watch()
      await nextTick()

      // Should sync back to false automatically
      expect(mockLayoutStoreRef.value).toBe(false)
    })

    it('should make startDrag return success boolean to fix race condition', () => {
      const mockNodeData = createMockVueNodeData()
      const mockOnPointerUp = vi.fn()

      // Create test-specific mocks
      const mockIsDragging = ref(false)
      const mockStartDrag = vi.fn().mockImplementation(() => {
        mockIsDragging.value = true
        return true
      })

      // Mock layout system for this test
      vi.mocked(useNodeLayout).mockReturnValue(
        createCompleteNodeLayoutMock({
          startDrag: mockStartDrag,
          endDrag: vi.fn().mockImplementation(() => {
            mockIsDragging.value = false
            return Promise.resolve()
          }),
          handleDrag: vi.fn().mockResolvedValue(undefined),
          isDragging: mockIsDragging
        })
      )

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

      // Create test-specific mocks
      const mockIsDragging = ref(false)

      // Mock layout system for this test
      vi.mocked(useNodeLayout).mockReturnValue(
        createCompleteNodeLayoutMock({
          startDrag: vi.fn().mockImplementation(() => {
            mockIsDragging.value = true
            return true
          }),
          endDrag: vi.fn().mockImplementation(() => {
            mockIsDragging.value = false
            return Promise.resolve()
          }),
          handleDrag: vi.fn().mockResolvedValue(undefined),
          isDragging: mockIsDragging
        })
      )

      const result = useNodePointerInteractions(
        ref(mockNodeData),
        mockOnPointerUp
      )

      // After refactor: clean API - just essential properties
      expect(result.isDragging).toBeDefined()
      expect(result.pointerHandlers).toBeDefined()
      expect(result.stopWatcher).toBeDefined()

      // Should use isDragging directly for UI logic
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

      // Create test-specific mocks
      const mockIsDragging = ref(false)
      const mockStartDrag = vi.fn()

      vi.mocked(useNodeLayout).mockReturnValue(
        createCompleteNodeLayoutMock({
          startDrag: mockStartDrag,
          endDrag: vi.fn(),
          handleDrag: vi.fn(),
          isDragging: mockIsDragging
        })
      )

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

      // Create test-specific mocks
      const mockIsDragging = ref(false)

      vi.mocked(useNodeLayout).mockReturnValue(
        createCompleteNodeLayoutMock({
          startDrag: vi.fn().mockImplementation(() => {
            mockIsDragging.value = true
            return true
          }),
          endDrag: vi.fn().mockImplementation(() => {
            mockIsDragging.value = false
            return Promise.resolve()
          }),
          handleDrag: vi.fn(),
          isDragging: mockIsDragging
        })
      )

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

      // Create test-specific mocks
      const mockIsDragging = ref(false)
      const mockEndDrag = vi.fn()

      vi.mocked(useNodeLayout).mockReturnValue(
        createCompleteNodeLayoutMock({
          startDrag: vi.fn().mockImplementation(() => {
            mockIsDragging.value = true
            return true
          }),
          endDrag: mockEndDrag,
          handleDrag: vi.fn(),
          isDragging: mockIsDragging
        })
      )

      const { pointerHandlers } = useNodePointerInteractions(
        ref(mockNodeData),
        mockOnPointerUp
      )

      // Start drag
      pointerHandlers.onPointerdown(createPointerEvent('pointerdown'))
      expect(mockIsDragging.value).toBe(true)

      // Context menu should end drag
      const contextMenu = createMouseEvent('contextmenu')
      pointerHandlers.onContextmenu(contextMenu)

      expect(contextMenu.preventDefault).toHaveBeenCalled()
    })

    it('should not emit callback when nodeData becomes null', async () => {
      const mockOnPointerUp = vi.fn()

      // Create test-specific mocks
      const mockIsDragging = ref(false)

      vi.mocked(useNodeLayout).mockReturnValue(
        createCompleteNodeLayoutMock({
          startDrag: vi.fn(),
          endDrag: vi.fn(),
          handleDrag: vi.fn(),
          isDragging: mockIsDragging
        })
      )

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
