import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import type { useNodeDragToCanvas as UseNodeDragToCanvasType } from './useNodeDragToCanvas'

const mockAddNodeOnGraph = vi.fn()
const mockConvertEventToCanvasOffset = vi.fn()
const mockCanvas = {
  canvas: {
    getBoundingClientRect: vi.fn()
  },
  convertEventToCanvasOffset: mockConvertEventToCanvasOffset
}

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: vi.fn(() => ({
    canvas: mockCanvas
  }))
}))

vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: vi.fn(() => ({
    addNodeOnGraph: mockAddNodeOnGraph
  }))
}))

describe('useNodeDragToCanvas', () => {
  let useNodeDragToCanvas: typeof UseNodeDragToCanvasType

  const mockNodeDef = {
    name: 'TestNode',
    display_name: 'Test Node'
  } as ComfyNodeDefImpl

  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()

    const module = await import('./useNodeDragToCanvas')
    useNodeDragToCanvas = module.useNodeDragToCanvas
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('startDrag', () => {
    it('should set isDragging to true and store the node definition', () => {
      const { isDragging, draggedNode, startDrag } = useNodeDragToCanvas()

      expect(isDragging.value).toBe(false)
      expect(draggedNode.value).toBeNull()

      startDrag(mockNodeDef)

      expect(isDragging.value).toBe(true)
      expect(draggedNode.value).toBe(mockNodeDef)
    })
  })

  describe('cancelDrag', () => {
    it('should reset isDragging and draggedNode', () => {
      const { isDragging, draggedNode, startDrag, cancelDrag } =
        useNodeDragToCanvas()

      startDrag(mockNodeDef)
      expect(isDragging.value).toBe(true)

      cancelDrag()

      expect(isDragging.value).toBe(false)
      expect(draggedNode.value).toBeNull()
    })
  })

  describe('setupGlobalListeners', () => {
    it('should add event listeners to document', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener')
      const { setupGlobalListeners } = useNodeDragToCanvas()

      setupGlobalListeners()

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'pointermove',
        expect.any(Function)
      )
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'pointerup',
        expect.any(Function),
        true
      )
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      )
    })

    it('should only setup listeners once', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener')
      const { setupGlobalListeners } = useNodeDragToCanvas()

      setupGlobalListeners()
      const callCount = addEventListenerSpy.mock.calls.length

      setupGlobalListeners()

      expect(addEventListenerSpy.mock.calls.length).toBe(callCount)
    })
  })

  describe('cursorPosition', () => {
    it('should update on pointermove', () => {
      const { cursorPosition, setupGlobalListeners } = useNodeDragToCanvas()

      setupGlobalListeners()

      const pointerEvent = new PointerEvent('pointermove', {
        clientX: 100,
        clientY: 200
      })
      document.dispatchEvent(pointerEvent)

      expect(cursorPosition.value).toEqual({ x: 100, y: 200 })
    })
  })

  describe('endDrag behavior', () => {
    it('should add node when pointer is over canvas', () => {
      mockCanvas.canvas.getBoundingClientRect.mockReturnValue({
        left: 0,
        right: 500,
        top: 0,
        bottom: 500
      })
      mockConvertEventToCanvasOffset.mockReturnValue([150, 150])

      const { startDrag, setupGlobalListeners } = useNodeDragToCanvas()

      setupGlobalListeners()
      startDrag(mockNodeDef)

      const pointerEvent = new PointerEvent('pointerup', {
        clientX: 250,
        clientY: 250,
        bubbles: true
      })
      document.dispatchEvent(pointerEvent)

      expect(mockAddNodeOnGraph).toHaveBeenCalledWith(mockNodeDef, {
        pos: [150, 150]
      })
    })

    it('should not add node when pointer is outside canvas', () => {
      mockCanvas.canvas.getBoundingClientRect.mockReturnValue({
        left: 0,
        right: 500,
        top: 0,
        bottom: 500
      })

      const { startDrag, setupGlobalListeners, isDragging } =
        useNodeDragToCanvas()

      setupGlobalListeners()
      startDrag(mockNodeDef)

      const pointerEvent = new PointerEvent('pointerup', {
        clientX: 600,
        clientY: 250,
        bubbles: true
      })
      document.dispatchEvent(pointerEvent)

      expect(mockAddNodeOnGraph).not.toHaveBeenCalled()
      expect(isDragging.value).toBe(false)
    })

    it('should cancel drag on Escape key', () => {
      const { startDrag, setupGlobalListeners, isDragging } =
        useNodeDragToCanvas()

      setupGlobalListeners()
      startDrag(mockNodeDef)

      expect(isDragging.value).toBe(true)

      const keyEvent = new KeyboardEvent('keydown', { key: 'Escape' })
      document.dispatchEvent(keyEvent)

      expect(isDragging.value).toBe(false)
    })

    it('should not cancel drag on other keys', () => {
      const { startDrag, setupGlobalListeners, isDragging } =
        useNodeDragToCanvas()

      setupGlobalListeners()
      startDrag(mockNodeDef)

      const keyEvent = new KeyboardEvent('keydown', { key: 'Enter' })
      document.dispatchEvent(keyEvent)

      expect(isDragging.value).toBe(true)
    })
  })
})
