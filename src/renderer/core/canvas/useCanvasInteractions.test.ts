import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { app } from '@/scripts/app'

// Mock stores
vi.mock('@/renderer/core/canvas/canvasStore', () => {
  const getCanvas = vi.fn()
  const setCursorStyle = vi.fn()
  return {
    useCanvasStore: vi.fn(() => ({
      getCanvas,
      setCursorStyle,
      isReadOnly: false
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

function createMockPointerEvent({
  type = 'pointermove',
  button = 0,
  buttons = 1
}: {
  type?: string
  button?: PointerEvent['button']
  buttons?: PointerEvent['buttons']
} = {}): PointerEvent {
  const event = new PointerEvent(type, { button, buttons })
  vi.spyOn(event, 'preventDefault')
  vi.spyOn(event, 'stopPropagation')
  return event
}

function createMockWheelEvent(
  ctrlKey = false,
  metaKey = false,
  deltaX = 0,
  deltaY = 0
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

describe('useCanvasInteractions', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('pointer handlers', () => {
    it('should intercept left mouse events when canvas is read_only to enable space+drag navigation', () => {
      const { getCanvas } = useCanvasStore()
      const mockCanvas = createMockLGraphCanvas(true)
      vi.mocked(getCanvas).mockReturnValue(mockCanvas)

      const { handlePointerMove } = useCanvasInteractions()

      const mockEvent = createMockPointerEvent({ buttons: 1 })
      handlePointerMove(mockEvent)

      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockEvent.stopPropagation).toHaveBeenCalled()
    })

    it('should forward middle pointerdown events to canvas', () => {
      const { getCanvas } = useCanvasStore()
      const mockCanvas = createMockLGraphCanvas(false)
      vi.mocked(getCanvas).mockReturnValue(mockCanvas)
      const { handlePointerDown } = useCanvasInteractions()

      const mockEvent = createMockPointerEvent({
        type: 'pointerdown',
        button: 1,
        buttons: 4
      })
      handlePointerDown(mockEvent)

      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockEvent.stopPropagation).toHaveBeenCalled()
      expect(app.canvas.canvas.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'pointerdown' })
      )
    })

    it('should forward chorded middle-button drags to canvas', () => {
      const { getCanvas } = useCanvasStore()
      const mockCanvas = createMockLGraphCanvas(false)
      vi.mocked(getCanvas).mockReturnValue(mockCanvas)
      const { handlePointerMove } = useCanvasInteractions()

      const mockEvent = createMockPointerEvent({ buttons: 5 })
      handlePointerMove(mockEvent)

      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockEvent.stopPropagation).toHaveBeenCalled()
      expect(app.canvas.canvas.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'pointermove' })
      )
    })

    it('should not prevent default when canvas is not in read_only mode and not middle button', () => {
      const { getCanvas } = useCanvasStore()
      const mockCanvas = createMockLGraphCanvas(false)
      vi.mocked(getCanvas).mockReturnValue(mockCanvas)
      const { handlePointerMove } = useCanvasInteractions()

      const mockEvent = createMockPointerEvent({ buttons: 1 })
      handlePointerMove(mockEvent)

      expect(mockEvent.preventDefault).not.toHaveBeenCalled()
      expect(mockEvent.stopPropagation).not.toHaveBeenCalled()
    })

    it('should return early when canvas is null', () => {
      const { getCanvas } = useCanvasStore()
      vi.mocked(getCanvas).mockReturnValue(null!)
      const { handlePointerMove } = useCanvasInteractions()

      const mockEvent = createMockPointerEvent({ buttons: 1 })
      handlePointerMove(mockEvent)

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

    /** Regression: trackpad pinch-zoom inside a focused textarea must not
     *  fall through to browser page zoom in non-standard navigation modes. */
    it.for(['legacy', 'custom'])(
      'should forward ctrl+wheel to canvas when capture element IS focused in %s mode',
      (mode) => {
        const { get } = useSettingStore()
        vi.mocked(get).mockReturnValue(mode)

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
      }
    )

    it('should forward meta+wheel to canvas when capture element IS focused', () => {
      const { get } = useSettingStore()
      vi.mocked(get).mockReturnValue('standard')

      const captureElement = document.createElement('div')
      captureElement.setAttribute('data-capture-wheel', 'true')
      const textarea = document.createElement('textarea')
      captureElement.appendChild(textarea)
      document.body.appendChild(captureElement)
      textarea.focus()

      const { handleWheel } = useCanvasInteractions()
      const mockEvent = createMockWheelEvent(false, true)
      Object.defineProperty(mockEvent, 'target', { value: textarea })

      handleWheel(mockEvent)

      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockEvent.stopPropagation).toHaveBeenCalled()

      document.body.removeChild(captureElement)
    })

    /** Regression: trackpad two-finger horizontal swipes inside a focused
     *  textarea must not fall through to browser back/forward navigation. */
    it.for(['standard', 'legacy', 'custom'])(
      'should forward horizontal-dominant wheel to canvas when capture element IS focused in %s mode',
      (mode) => {
        const { get } = useSettingStore()
        vi.mocked(get).mockReturnValue(mode)

        const captureElement = document.createElement('div')
        captureElement.setAttribute('data-capture-wheel', 'true')
        const textarea = document.createElement('textarea')
        captureElement.appendChild(textarea)
        document.body.appendChild(captureElement)
        textarea.focus()

        const { handleWheel } = useCanvasInteractions()
        const mockEvent = createMockWheelEvent(false, false, 30, 5)
        Object.defineProperty(mockEvent, 'target', { value: textarea })

        handleWheel(mockEvent)

        expect(mockEvent.preventDefault).toHaveBeenCalled()
        expect(mockEvent.stopPropagation).toHaveBeenCalled()

        document.body.removeChild(captureElement)
      }
    )

    it('should NOT forward vertical-dominant wheel when capture element IS focused', () => {
      const { get } = useSettingStore()
      vi.mocked(get).mockReturnValue('standard')

      const captureElement = document.createElement('div')
      captureElement.setAttribute('data-capture-wheel', 'true')
      const textarea = document.createElement('textarea')
      captureElement.appendChild(textarea)
      document.body.appendChild(captureElement)
      textarea.focus()

      const { handleWheel } = useCanvasInteractions()
      const mockEvent = createMockWheelEvent(false, false, 0, 30)
      Object.defineProperty(mockEvent, 'target', { value: textarea })

      handleWheel(mockEvent)

      expect(mockEvent.preventDefault).not.toHaveBeenCalled()
      expect(mockEvent.stopPropagation).not.toHaveBeenCalled()

      document.body.removeChild(captureElement)
    })
  })
})
