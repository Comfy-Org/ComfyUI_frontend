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
  deltaX = 0,
  deltaY = 100
): WheelEvent {
  const mockEvent: Partial<WheelEvent> = {
    ctrlKey,
    metaKey,
    deltaX,
    deltaY,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn()
  }
  return mockEvent as WheelEvent
}

function makeScrollable(element: HTMLElement) {
  Object.defineProperty(element, 'clientHeight', {
    configurable: true,
    value: 100
  })
  Object.defineProperty(element, 'scrollHeight', {
    configurable: true,
    value: 200
  })
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

    it('should NOT forward wheel events when non-text capture element IS focused', () => {
      const { get } = useSettingStore()
      vi.mocked(get).mockReturnValue('legacy')

      const captureElement = document.createElement('div')
      captureElement.setAttribute('data-capture-wheel', 'true')
      const input = document.createElement('input')
      captureElement.appendChild(input)
      document.body.appendChild(captureElement)
      input.focus()

      const { handleWheel } = useCanvasInteractions()
      const mockEvent = createMockWheelEvent()
      Object.defineProperty(mockEvent, 'target', { value: input })

      handleWheel(mockEvent)

      expect(mockEvent.preventDefault).not.toHaveBeenCalled()
      expect(mockEvent.stopPropagation).not.toHaveBeenCalled()

      document.body.removeChild(captureElement)
    })

    it('should NOT forward vertical wheel events when text capture element is scrollable', () => {
      const { get } = useSettingStore()
      vi.mocked(get).mockReturnValue('legacy')

      const textarea = document.createElement('textarea')
      textarea.setAttribute('data-capture-wheel', 'true')
      makeScrollable(textarea)
      document.body.appendChild(textarea)

      const { handleWheel } = useCanvasInteractions()
      const mockEvent = createMockWheelEvent(false, false, 0, 100)
      Object.defineProperty(mockEvent, 'target', { value: textarea })

      handleWheel(mockEvent)

      expect(mockEvent.preventDefault).not.toHaveBeenCalled()
      expect(mockEvent.stopPropagation).not.toHaveBeenCalled()

      document.body.removeChild(textarea)
    })

    it('should forward vertical wheel events when text capture element is not scrollable', () => {
      const { get } = useSettingStore()
      vi.mocked(get).mockReturnValue('legacy')

      const textarea = document.createElement('textarea')
      textarea.setAttribute('data-capture-wheel', 'true')
      document.body.appendChild(textarea)
      textarea.focus()

      const { handleWheel } = useCanvasInteractions()
      const mockEvent = createMockWheelEvent(false, false, 0, 100)
      Object.defineProperty(mockEvent, 'target', { value: textarea })

      handleWheel(mockEvent)

      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockEvent.stopPropagation).toHaveBeenCalled()

      document.body.removeChild(textarea)
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
  })
})
