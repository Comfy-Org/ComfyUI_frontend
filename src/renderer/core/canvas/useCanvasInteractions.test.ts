import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'

// Mock stores
vi.mock('@/renderer/core/canvas/canvasStore', () => {
  const getCanvas = vi.fn()
  const setCursorStyle = vi.fn()
  return {
    useCanvasStore: vi.fn(() => ({
      getCanvas,
      setCursorStyle
    }))
  }
})
vi.mock('@/platform/settings/settingStore', () => {
  const getFn = vi.fn()
  return { useSettingStore: vi.fn(() => ({ get: getFn })) }
})
vi.mock('@/scripts/app', () => ({
  app: {
    canvas: {
      canvas: {
        dispatchEvent: vi.fn()
      }
    }
  }
}))

function createMockLGraphCanvas(read_only = true): LGraphCanvas {
  const mockCanvas: Partial<LGraphCanvas> = { read_only }
  return mockCanvas as LGraphCanvas
}

function createMockPointerEvent(
  buttons: PointerEvent['buttons'] = 1
): PointerEvent {
  const mockEvent: Partial<PointerEvent> = {
    buttons,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn()
  }
  return mockEvent as PointerEvent
}

function createMockWheelEvent(
  ctrlKey = false,
  metaKey = false,
  deltaY = 0,
  target?: HTMLElement
): WheelEvent {
  const mockEvent: Partial<WheelEvent> = {
    ctrlKey,
    metaKey,
    deltaY,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn()
  }
  if (target) {
    Object.defineProperty(mockEvent, 'target', { value: target })
  }
  return mockEvent as WheelEvent
}

describe('useCanvasInteractions', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('handlePointer', () => {
    it('should intercept left mouse events when canvas is read_only to enable space+drag navigation', () => {
      const { getCanvas } = useCanvasStore()
      const mockCanvas = createMockLGraphCanvas(true)
      vi.mocked(getCanvas).mockReturnValue(mockCanvas)

      const { handlePointer } = useCanvasInteractions()

      const mockEvent = createMockPointerEvent(1) // Left Mouse Button
      handlePointer(mockEvent)

      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockEvent.stopPropagation).toHaveBeenCalled()
    })

    it('should forward middle mouse button events to canvas', () => {
      const { getCanvas } = useCanvasStore()
      const mockCanvas = createMockLGraphCanvas(false)
      vi.mocked(getCanvas).mockReturnValue(mockCanvas)
      const { handlePointer } = useCanvasInteractions()

      const mockEvent = createMockPointerEvent(4) // Middle mouse button
      handlePointer(mockEvent)

      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockEvent.stopPropagation).toHaveBeenCalled()
    })

    it('should not prevent default when canvas is not in read_only mode and not middle button', () => {
      const { getCanvas } = useCanvasStore()
      const mockCanvas = createMockLGraphCanvas(false)
      vi.mocked(getCanvas).mockReturnValue(mockCanvas)
      const { handlePointer } = useCanvasInteractions()

      const mockEvent = createMockPointerEvent(1)
      handlePointer(mockEvent)

      expect(mockEvent.preventDefault).not.toHaveBeenCalled()
      expect(mockEvent.stopPropagation).not.toHaveBeenCalled()
    })

    it('should return early when canvas is null', () => {
      const { getCanvas } = useCanvasStore()
      vi.mocked(getCanvas).mockReturnValue(null!)
      const { handlePointer } = useCanvasInteractions()

      const mockEvent = createMockPointerEvent(1)
      handlePointer(mockEvent)

      expect(getCanvas).toHaveBeenCalled()
      expect(mockEvent.preventDefault).not.toHaveBeenCalled()
      expect(mockEvent.stopPropagation).not.toHaveBeenCalled()
    })
  })

  describe('handleWheel', () => {
    it('should forward ctrl+wheel events to canvas in standard nav mode', () => {
      const { get } = useSettingStore()
      vi.mocked(get).mockReturnValue('standard')

      const { handleWheel } = useCanvasInteractions()

      // Ctrl key pressed
      const mockEvent = createMockWheelEvent(true)

      handleWheel(mockEvent)

      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockEvent.stopPropagation).toHaveBeenCalled()
    })

    it('should forward all wheel events to canvas in legacy nav mode', () => {
      const { get } = useSettingStore()
      vi.mocked(get).mockReturnValue('legacy')
      const { handleWheel } = useCanvasInteractions()

      const mockEvent = createMockWheelEvent()
      handleWheel(mockEvent)

      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockEvent.stopPropagation).toHaveBeenCalled()
    })

    it('should not prevent default for regular wheel events in standard nav mode', () => {
      const { get } = useSettingStore()
      vi.mocked(get).mockReturnValue('standard')
      const { handleWheel } = useCanvasInteractions()

      const mockEvent = createMockWheelEvent()
      handleWheel(mockEvent)

      expect(mockEvent.preventDefault).not.toHaveBeenCalled()
      expect(mockEvent.stopPropagation).not.toHaveBeenCalled()
    })
    it('should forward wheel events to canvas when capture element is NOT focused', () => {
      const { get } = useSettingStore()
      vi.mocked(get).mockReturnValue('legacy')

      const captureElement = document.createElement('div')
      captureElement.setAttribute('data-capture-wheel', 'true')
      const textarea = document.createElement('textarea')
      captureElement.appendChild(textarea)
      document.body.appendChild(captureElement)

      const { handleWheel } = useCanvasInteractions()
      const mockEvent = createMockWheelEvent()
      Object.defineProperty(mockEvent, 'target', { value: textarea })

      handleWheel(mockEvent)

      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockEvent.stopPropagation).toHaveBeenCalled()

      document.body.removeChild(captureElement)
    })

    it('should NOT forward wheel events when capture element IS focused', () => {
      const { get } = useSettingStore()
      vi.mocked(get).mockReturnValue('legacy')

      const captureElement = document.createElement('div')
      captureElement.setAttribute('data-capture-wheel', 'true')
      const textarea = document.createElement('textarea')
      captureElement.appendChild(textarea)
      document.body.appendChild(captureElement)
      textarea.focus()

      const { handleWheel } = useCanvasInteractions()
      const mockEvent = createMockWheelEvent()
      Object.defineProperty(mockEvent, 'target', { value: textarea })

      handleWheel(mockEvent)

      expect(mockEvent.preventDefault).not.toHaveBeenCalled()
      expect(mockEvent.stopPropagation).not.toHaveBeenCalled()

      document.body.removeChild(captureElement)
    })

    it('should forward ctrl+wheel to canvas when capture element IS focused in standard mode', () => {
      const { get } = useSettingStore()
      vi.mocked(get).mockReturnValue('standard')

      const captureElement = document.createElement('div')
      captureElement.setAttribute('data-capture-wheel', 'true')
      const textarea = document.createElement('textarea')
      captureElement.appendChild(textarea)
      document.body.appendChild(captureElement)
      textarea.focus()

      const { handleWheel } = useCanvasInteractions()
      const mockEvent = createMockWheelEvent(true)
      Object.defineProperty(mockEvent, 'target', { value: textarea })

      handleWheel(mockEvent)

      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockEvent.stopPropagation).toHaveBeenCalled()

      document.body.removeChild(captureElement)
    })

    describe('scrollable capture-wheel elements', () => {
      function createScrollableElement(): {
        container: HTMLDivElement
        inner: HTMLDivElement
        cleanup: () => void
      } {
        const container = document.createElement('div')
        container.setAttribute('data-capture-wheel', 'true')
        // Simulate scrollable element with overflow content
        Object.defineProperties(container, {
          scrollHeight: { value: 200, configurable: true },
          clientHeight: { value: 100, configurable: true },
          scrollTop: { value: 50, writable: true, configurable: true }
        })
        const inner = document.createElement('div')
        container.appendChild(inner)
        document.body.appendChild(container)
        return {
          container,
          inner,
          cleanup: () => document.body.removeChild(container)
        }
      }

      it('should NOT forward wheel when scrollable element has room to scroll', () => {
        const { get } = useSettingStore()
        vi.mocked(get).mockReturnValue('standard')

        const { inner, cleanup } = createScrollableElement()
        const { handleWheel } = useCanvasInteractions()
        // scrollTop=50, scrolling down, not at bottom
        const mockEvent = createMockWheelEvent(false, false, 100, inner)

        handleWheel(mockEvent)

        expect(mockEvent.preventDefault).not.toHaveBeenCalled()
        expect(mockEvent.stopPropagation).not.toHaveBeenCalled()
        cleanup()
      })

      it('should forward wheel when scrollable element is at top boundary scrolling up', () => {
        const { get } = useSettingStore()
        vi.mocked(get).mockReturnValue('legacy')

        const { container, inner, cleanup } = createScrollableElement()
        // At top
        Object.defineProperty(container, 'scrollTop', {
          value: 0,
          configurable: true
        })
        const { handleWheel } = useCanvasInteractions()
        // Scrolling up (deltaY < 0) while at top
        const mockEvent = createMockWheelEvent(false, false, -100, inner)

        handleWheel(mockEvent)

        expect(mockEvent.preventDefault).toHaveBeenCalled()
        expect(mockEvent.stopPropagation).toHaveBeenCalled()
        cleanup()
      })

      it('should forward wheel when scrollable element is at bottom boundary scrolling down', () => {
        const { get } = useSettingStore()
        vi.mocked(get).mockReturnValue('legacy')

        const { container, inner, cleanup } = createScrollableElement()
        // At bottom: scrollTop + clientHeight >= scrollHeight
        Object.defineProperty(container, 'scrollTop', {
          value: 100,
          configurable: true
        })
        const { handleWheel } = useCanvasInteractions()
        // Scrolling down (deltaY > 0) while at bottom
        const mockEvent = createMockWheelEvent(false, false, 100, inner)

        handleWheel(mockEvent)

        expect(mockEvent.preventDefault).toHaveBeenCalled()
        expect(mockEvent.stopPropagation).toHaveBeenCalled()
        cleanup()
      })

      it('should forward ctrl+wheel to canvas even when scrollable element has room', () => {
        const { get } = useSettingStore()
        vi.mocked(get).mockReturnValue('standard')

        const { inner, cleanup } = createScrollableElement()
        const { handleWheel } = useCanvasInteractions()
        // Ctrl+wheel for zoom — should bypass scroll capture
        const mockEvent = createMockWheelEvent(true, false, 100, inner)

        handleWheel(mockEvent)

        expect(mockEvent.preventDefault).toHaveBeenCalled()
        expect(mockEvent.stopPropagation).toHaveBeenCalled()
        cleanup()
      })
    })
  })
})
