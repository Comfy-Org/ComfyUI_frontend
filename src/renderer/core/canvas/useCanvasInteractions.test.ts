import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'

function createMockLGraphCanvas(
  read_only = true,
  canvas = document.createElement('canvas')
): LGraphCanvas {
  const mockCanvas: Partial<LGraphCanvas> = { read_only, canvas }
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
  let canvasElement: HTMLCanvasElement

  beforeEach(() => {
    canvasElement = document.createElement('canvas')
    vi.spyOn(canvasElement, 'dispatchEvent').mockReturnValue(true)
    useCanvasStore().canvas = createMockLGraphCanvas(false, canvasElement)
  })

  it.for([
    { name: 'middle button', button: 1, buttons: 4 },
    { name: 'primary button', button: 0, buttons: 1 }
  ])(
    'ignores $name pointer events before the canvas exists',
    ({ button, buttons }) => {
      useCanvasStore().canvas = null
      const { handlePointerDown } = useCanvasInteractions()
      const mockEvent = createMockPointerEvent({
        type: 'pointerdown',
        button,
        buttons
      })

      handlePointerDown(mockEvent)

      expect(mockEvent.preventDefault).not.toHaveBeenCalled()
      expect(canvasElement.dispatchEvent).not.toHaveBeenCalled()
    }
  )

  describe('node policy', () => {
    it.for([
      {
        picking: false,
        readOnly: false,
        shouldHandleNodePointerEvents: true,
        canEditNodes: true,
        canFocusWidgets: true
      },
      {
        picking: true,
        readOnly: false,
        shouldHandleNodePointerEvents: true,
        canEditNodes: false,
        canFocusWidgets: false
      },
      {
        picking: false,
        readOnly: true,
        shouldHandleNodePointerEvents: false,
        canEditNodes: false,
        canFocusWidgets: true
      },
      {
        picking: true,
        readOnly: true,
        shouldHandleNodePointerEvents: false,
        canEditNodes: false,
        canFocusWidgets: false
      }
    ])(
      'picking=$picking readOnly=$readOnly selects nodes: $shouldHandleNodePointerEvents, edits nodes: $canEditNodes, focuses widgets: $canFocusWidgets',
      (row) => {
        useAgentNodeSelectionStore().isActive = row.picking
        useCanvasStore().isReadOnly = row.readOnly

        const { shouldHandleNodePointerEvents, canEditNodes, canFocusWidgets } =
          useCanvasInteractions()

        expect(shouldHandleNodePointerEvents.value).toBe(
          row.shouldHandleNodePointerEvents
        )
        expect(canEditNodes.value).toBe(row.canEditNodes)
        expect(canFocusWidgets.value).toBe(row.canFocusWidgets)
      }
    )
  })

  describe('pointer handlers', () => {
    it('should intercept left mouse events when canvas is read_only to enable space+drag navigation', () => {
      useCanvasStore().canvas = createMockLGraphCanvas(true, canvasElement)

      const { handlePointerMove } = useCanvasInteractions()

      const mockEvent = createMockPointerEvent({ buttons: 1 })
      handlePointerMove(mockEvent)

      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockEvent.stopPropagation).toHaveBeenCalled()
    })

    it('should forward middle pointerdown events to canvas', () => {
      const { handlePointerDown } = useCanvasInteractions()

      const mockEvent = createMockPointerEvent({
        type: 'pointerdown',
        button: 1,
        buttons: 4
      })
      handlePointerDown(mockEvent)

      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockEvent.stopPropagation).toHaveBeenCalled()
      expect(canvasElement.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'pointerdown' })
      )
    })

    it('should forward chorded middle-button drags to canvas', () => {
      const { handlePointerMove } = useCanvasInteractions()

      const mockEvent = createMockPointerEvent({ buttons: 5 })
      handlePointerMove(mockEvent)

      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockEvent.stopPropagation).toHaveBeenCalled()
      expect(canvasElement.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'pointermove' })
      )
    })

    it('should not prevent default when canvas is not in read_only mode and not middle button', () => {
      const { handlePointerMove } = useCanvasInteractions()

      const mockEvent = createMockPointerEvent({ buttons: 1 })
      handlePointerMove(mockEvent)

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
