import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import type { useNodeDragToCanvas as UseNodeDragToCanvasType } from './useNodeDragToCanvas'

const {
  mockAddNodeOnGraph,
  mockConvertEventToCanvasOffset,
  mockSelectItems,
  mockCanvas,
  mockToastAdd
} = vi.hoisted(() => {
  const mockConvertEventToCanvasOffset = vi.fn()
  const mockSelectItems = vi.fn()
  return {
    mockAddNodeOnGraph: vi.fn(),
    mockConvertEventToCanvasOffset,
    mockSelectItems,
    mockToastAdd: vi.fn(),
    mockCanvas: {
      canvas: {
        getBoundingClientRect: vi.fn()
      },
      convertEventToCanvasOffset: mockConvertEventToCanvasOffset,
      selectItems: mockSelectItems
    }
  }
})

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

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: vi.fn(() => ({ add: mockToastAdd }))
}))

vi.mock('@/i18n', () => ({ t: (key: string) => key }))

describe('useNodeDragToCanvas', () => {
  let useNodeDragToCanvas: typeof UseNodeDragToCanvasType

  const mockNodeDef = {
    name: 'TestNode',
    display_name: 'Test Node'
  } as ComfyNodeDefImpl

  beforeEach(async () => {
    vi.resetModules()
    vi.resetAllMocks()

    const module = await import('./useNodeDragToCanvas')
    useNodeDragToCanvas = module.useNodeDragToCanvas
  })

  afterEach(() => {
    const { cancelDrag } = useNodeDragToCanvas()
    cancelDrag()
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

  describe('drag listener lifecycle', () => {
    it('should attach document listeners on startDrag', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener')
      const { startDrag } = useNodeDragToCanvas()

      startDrag(mockNodeDef)

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'pointerdown',
        expect.any(Function),
        true
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

    it('should not attach drag listeners until a drag starts', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener')
      useNodeDragToCanvas()

      expect(addEventListenerSpy).not.toHaveBeenCalledWith(
        'pointerup',
        expect.any(Function),
        true
      )
      expect(addEventListenerSpy).not.toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      )
    })

    it('should detach document listeners on cancelDrag', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')
      const { startDrag, cancelDrag } = useNodeDragToCanvas()

      startDrag(mockNodeDef)
      cancelDrag()

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'pointerdown',
        expect.any(Function),
        true
      )
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'pointerup',
        expect.any(Function),
        true
      )
    })

    it('should only attach listeners once across re-arms', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener')
      const { startDrag } = useNodeDragToCanvas()

      startDrag(mockNodeDef)
      const callCount = addEventListenerSpy.mock.calls.length

      startDrag(mockNodeDef)

      expect(addEventListenerSpy.mock.calls.length).toBe(callCount)
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

      const { startDrag } = useNodeDragToCanvas()
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

      const { startDrag, isDragging } = useNodeDragToCanvas()
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
      const { startDrag, isDragging } = useNodeDragToCanvas()
      startDrag(mockNodeDef)

      expect(isDragging.value).toBe(true)

      const keyEvent = new KeyboardEvent('keydown', { key: 'Escape' })
      document.dispatchEvent(keyEvent)

      expect(isDragging.value).toBe(false)
    })

    it('should not cancel drag on other keys', () => {
      const { startDrag, isDragging } = useNodeDragToCanvas()
      startDrag(mockNodeDef)

      const keyEvent = new KeyboardEvent('keydown', { key: 'Enter' })
      document.dispatchEvent(keyEvent)

      expect(isDragging.value).toBe(true)
    })

    it('should select the placed node when one is returned from the graph', () => {
      mockCanvas.canvas.getBoundingClientRect.mockReturnValue({
        left: 0,
        right: 500,
        top: 0,
        bottom: 500
      })
      mockConvertEventToCanvasOffset.mockReturnValue([150, 150])
      const placedNode = { id: 1 }
      mockAddNodeOnGraph.mockReturnValue(placedNode)

      const { startDrag } = useNodeDragToCanvas()
      startDrag(mockNodeDef)

      document.dispatchEvent(
        new PointerEvent('pointerup', {
          clientX: 250,
          clientY: 250,
          bubbles: true
        })
      )

      expect(mockSelectItems).toHaveBeenCalledWith([placedNode])
    })

    it('should apply the requested widget values to the placed node', () => {
      mockCanvas.canvas.getBoundingClientRect.mockReturnValue({
        left: 0,
        right: 500,
        top: 0,
        bottom: 500
      })
      mockConvertEventToCanvasOffset.mockReturnValue([150, 150])
      const widget = { name: 'ckpt_name', value: '' }
      mockAddNodeOnGraph.mockReturnValue({ id: 1, widgets: [widget] })

      const { startDrag } = useNodeDragToCanvas()
      startDrag(mockNodeDef, {
        widgetValues: { ckpt_name: 'model.safetensors' }
      })

      document.dispatchEvent(
        new PointerEvent('pointerup', {
          clientX: 250,
          clientY: 250,
          bubbles: true
        })
      )

      expect(widget.value).toBe('model.safetensors')
    })

    it('should warn but still place the node when a requested widget is missing', () => {
      mockCanvas.canvas.getBoundingClientRect.mockReturnValue({
        left: 0,
        right: 500,
        top: 0,
        bottom: 500
      })
      mockConvertEventToCanvasOffset.mockReturnValue([150, 150])
      const placedNode = { id: 1, widgets: [] }
      mockAddNodeOnGraph.mockReturnValue(placedNode)
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      const { startDrag } = useNodeDragToCanvas()
      startDrag(mockNodeDef, {
        widgetValues: { ckpt_name: 'model.safetensors' }
      })

      document.dispatchEvent(
        new PointerEvent('pointerup', {
          clientX: 250,
          clientY: 250,
          bubbles: true
        })
      )

      expect(mockSelectItems).toHaveBeenCalledWith([placedNode])
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'warn',
          detail: 'assetBrowser.failedToSetModelValue'
        })
      )
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('ckpt_name')
      )
    })

    it('should show an error toast when the graph fails to add the node', () => {
      mockCanvas.canvas.getBoundingClientRect.mockReturnValue({
        left: 0,
        right: 500,
        top: 0,
        bottom: 500
      })
      mockConvertEventToCanvasOffset.mockReturnValue([150, 150])
      mockAddNodeOnGraph.mockReturnValue(null)
      vi.spyOn(console, 'error').mockImplementation(() => {})

      const { startDrag } = useNodeDragToCanvas()
      startDrag(mockNodeDef)

      document.dispatchEvent(
        new PointerEvent('pointerup', {
          clientX: 250,
          clientY: 250,
          bubbles: true
        })
      )

      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          detail: 'assetBrowser.failedToCreateNode'
        })
      )
    })

    it('should not call selectItems when graph returns no node', () => {
      mockCanvas.canvas.getBoundingClientRect.mockReturnValue({
        left: 0,
        right: 500,
        top: 0,
        bottom: 500
      })
      mockConvertEventToCanvasOffset.mockReturnValue([150, 150])
      mockAddNodeOnGraph.mockReturnValue(null)
      vi.spyOn(console, 'error').mockImplementation(() => {})

      const { startDrag } = useNodeDragToCanvas()
      startDrag(mockNodeDef)

      document.dispatchEvent(
        new PointerEvent('pointerup', {
          clientX: 250,
          clientY: 250,
          bubbles: true
        })
      )

      expect(mockSelectItems).not.toHaveBeenCalled()
    })

    it('should not add node on pointerup when in native drag mode', () => {
      mockCanvas.canvas.getBoundingClientRect.mockReturnValue({
        left: 0,
        right: 500,
        top: 0,
        bottom: 500
      })
      mockConvertEventToCanvasOffset.mockReturnValue([150, 150])

      const { startDrag, isDragging } = useNodeDragToCanvas()
      startDrag(mockNodeDef, { mode: 'native' })

      const pointerEvent = new PointerEvent('pointerup', {
        clientX: 250,
        clientY: 250,
        bubbles: true
      })
      document.dispatchEvent(pointerEvent)

      expect(mockAddNodeOnGraph).not.toHaveBeenCalled()
      expect(isDragging.value).toBe(true)
    })
  })

  describe('handleNativeDrop', () => {
    it('should add node when drop position is over canvas', () => {
      mockCanvas.canvas.getBoundingClientRect.mockReturnValue({
        left: 0,
        right: 500,
        top: 0,
        bottom: 500
      })
      mockConvertEventToCanvasOffset.mockReturnValue([200, 200])

      const { startDrag, handleNativeDrop } = useNodeDragToCanvas()

      startDrag(mockNodeDef, { mode: 'native' })
      handleNativeDrop(250, 250)

      expect(mockAddNodeOnGraph).toHaveBeenCalledWith(mockNodeDef, {
        pos: [200, 200]
      })
    })

    it('should not add node when drop position is outside canvas', () => {
      mockCanvas.canvas.getBoundingClientRect.mockReturnValue({
        left: 0,
        right: 500,
        top: 0,
        bottom: 500
      })

      const { startDrag, handleNativeDrop, isDragging } = useNodeDragToCanvas()

      startDrag(mockNodeDef, { mode: 'native' })
      handleNativeDrop(600, 250)

      expect(mockAddNodeOnGraph).not.toHaveBeenCalled()
      expect(isDragging.value).toBe(false)
    })

    it('should not add node when dragMode is click', () => {
      mockCanvas.canvas.getBoundingClientRect.mockReturnValue({
        left: 0,
        right: 500,
        top: 0,
        bottom: 500
      })
      mockConvertEventToCanvasOffset.mockReturnValue([200, 200])

      const { startDrag, handleNativeDrop } = useNodeDragToCanvas()

      startDrag(mockNodeDef)
      handleNativeDrop(250, 250)

      expect(mockAddNodeOnGraph).not.toHaveBeenCalled()
    })

    it('should reset drag state after drop', () => {
      mockCanvas.canvas.getBoundingClientRect.mockReturnValue({
        left: 0,
        right: 500,
        top: 0,
        bottom: 500
      })
      mockConvertEventToCanvasOffset.mockReturnValue([200, 200])

      const { startDrag, handleNativeDrop, isDragging } = useNodeDragToCanvas()

      startDrag(mockNodeDef, { mode: 'native' })
      handleNativeDrop(250, 250)

      expect(isDragging.value).toBe(false)
    })
  })

  describe('blockCommitPointerDown', () => {
    function dispatchPointerDown(x: number, y: number) {
      const event = new PointerEvent('pointerdown', {
        clientX: x,
        clientY: y,
        bubbles: true,
        cancelable: true
      })
      const stopSpy = vi.spyOn(event, 'stopImmediatePropagation')
      document.dispatchEvent(event)
      return stopSpy
    }

    beforeEach(() => {
      mockCanvas.canvas.getBoundingClientRect.mockReturnValue({
        left: 0,
        right: 500,
        top: 0,
        bottom: 500
      })
    })

    it('should stop propagation when in click-drag mode over canvas', () => {
      const { startDrag } = useNodeDragToCanvas()
      startDrag(mockNodeDef)

      expect(dispatchPointerDown(250, 250)).toHaveBeenCalled()
    })

    it('should not stop propagation once the drag is cancelled', () => {
      const { startDrag, cancelDrag } = useNodeDragToCanvas()
      startDrag(mockNodeDef)
      cancelDrag()

      expect(dispatchPointerDown(250, 250)).not.toHaveBeenCalled()
    })

    it('should not stop propagation in native drag mode', () => {
      const { startDrag } = useNodeDragToCanvas()
      startDrag(mockNodeDef, { mode: 'native' })

      expect(dispatchPointerDown(250, 250)).not.toHaveBeenCalled()
    })

    it('should not stop propagation when pointer is outside canvas', () => {
      const { startDrag } = useNodeDragToCanvas()
      startDrag(mockNodeDef)

      expect(dispatchPointerDown(600, 250)).not.toHaveBeenCalled()
    })
  })

  describe('native drag position tracking', () => {
    beforeEach(() => {
      mockCanvas.canvas.getBoundingClientRect.mockReturnValue({
        left: 0,
        right: 500,
        top: 0,
        bottom: 500
      })
      mockConvertEventToCanvasOffset.mockReturnValue([300, 300])
    })

    // happy-dom has no DragEvent constructor; MouseEvent works since the
    // handler only reads clientX/clientY.
    function fireDrag(x: number, y: number) {
      document.dispatchEvent(
        new MouseEvent('dragover', { clientX: x, clientY: y, bubbles: true })
      )
    }

    it('should prefer tracked drag position over dragend coordinates', () => {
      const { startDrag, handleNativeDrop } = useNodeDragToCanvas()
      startDrag(mockNodeDef, { mode: 'native' })

      fireDrag(250, 250)
      // dragend supplies a bad position (the Firefox bug); the tracked one
      // from the last drag event should win.
      handleNativeDrop(1505, 102)

      expect(mockConvertEventToCanvasOffset).toHaveBeenCalledWith({
        clientX: 250,
        clientY: 250
      })
    })

    it('should ignore drag events with (0, 0)', () => {
      const { startDrag, handleNativeDrop } = useNodeDragToCanvas()
      startDrag(mockNodeDef, { mode: 'native' })

      fireDrag(250, 250)
      fireDrag(0, 0)
      handleNativeDrop(1505, 102)

      expect(mockConvertEventToCanvasOffset).toHaveBeenCalledWith({
        clientX: 250,
        clientY: 250
      })
    })

    it('should fall back to dragend coordinates when no drag fired', () => {
      const { startDrag, handleNativeDrop } = useNodeDragToCanvas()
      startDrag(mockNodeDef, { mode: 'native' })

      handleNativeDrop(250, 250)

      expect(mockConvertEventToCanvasOffset).toHaveBeenCalledWith({
        clientX: 250,
        clientY: 250
      })
    })

    it('should clear tracked position between drags', () => {
      const { startDrag, handleNativeDrop } = useNodeDragToCanvas()
      startDrag(mockNodeDef, { mode: 'native' })
      fireDrag(250, 250)
      handleNativeDrop(1505, 102)

      // Second drag - no drag events, so we should fall back to args.
      startDrag(mockNodeDef, { mode: 'native' })
      handleNativeDrop(300, 300)

      expect(mockConvertEventToCanvasOffset).toHaveBeenLastCalledWith({
        clientX: 300,
        clientY: 300
      })
    })
  })
})
