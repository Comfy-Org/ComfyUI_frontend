import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'

import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import type { useNodeDragToCanvas as UseNodeDragToCanvasType } from './useNodeDragToCanvas'

const {
  mockAddNodeOnGraph,
  mockConvertEventToCanvasOffset,
  mockSelectItems,
  mockCanvasStore,
  mockToastAdd,
  canvasElement
} = vi.hoisted(() => {
  const canvasElement = document.createElement(
    'canvas'
  ) as HTMLCanvasElement & { getBoundingClientRect: Mock }
  canvasElement.getBoundingClientRect = vi.fn()
  const mockConvertEventToCanvasOffset = vi.fn()
  const mockSelectItems = vi.fn()
  const mockCanvas = {
    canvas: canvasElement,
    convertEventToCanvasOffset: mockConvertEventToCanvasOffset,
    selectItems: mockSelectItems
  }
  return {
    mockAddNodeOnGraph: vi.fn(),
    mockConvertEventToCanvasOffset,
    mockSelectItems,
    mockToastAdd: vi.fn(),
    canvasElement,
    mockCanvasStore: { canvas: mockCanvas, isGhostPlacing: false }
  }
})

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: vi.fn(() => mockCanvasStore)
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

const CANVAS_RECT = { left: 0, right: 500, top: 0, bottom: 500 }

describe('useNodeDragToCanvas', () => {
  let useNodeDragToCanvas: typeof UseNodeDragToCanvasType
  let panelElement: HTMLElement

  const mockNodeDef = {
    name: 'TestNode',
    display_name: 'Test Node'
  } as ComfyNodeDefImpl

  beforeEach(async () => {
    vi.resetModules()
    vi.resetAllMocks()

    document.body.appendChild(canvasElement)
    panelElement = document.createElement('div')
    document.body.appendChild(panelElement)
    mockCanvasStore.isGhostPlacing = false

    const module = await import('./useNodeDragToCanvas')
    useNodeDragToCanvas = module.useNodeDragToCanvas
  })

  afterEach(() => {
    const { cancelDrag } = useNodeDragToCanvas()
    cancelDrag()
    canvasElement.remove()
    panelElement.remove()
    vi.restoreAllMocks()
  })

  // The canvas is full-bleed under the sidebar/properties panels, so the click
  // path commits based on the event target rather than geometry. Dispatch on the
  // real element so `isCanvasTarget` (canvas.contains(target)) behaves as in the app.
  function dispatchPointerUp(
    x: number,
    y: number,
    target: EventTarget = canvasElement
  ) {
    target.dispatchEvent(
      new PointerEvent('pointerup', { clientX: x, clientY: y, bubbles: true })
    )
  }

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

  describe('ghost placement flag', () => {
    it('should mark ghost placement active for the duration of the drag', () => {
      const { startDrag, cancelDrag } = useNodeDragToCanvas()

      startDrag(mockNodeDef)
      expect(mockCanvasStore.isGhostPlacing).toBe(true)

      cancelDrag()
      expect(mockCanvasStore.isGhostPlacing).toBe(false)
    })

    it('should not clear ghost placement when cancelling without a drag', () => {
      mockCanvasStore.isGhostPlacing = true
      const { cancelDrag } = useNodeDragToCanvas()

      cancelDrag()

      expect(mockCanvasStore.isGhostPlacing).toBe(true)
    })

    it('should leave node interaction intact during a native drag', () => {
      const { startDrag, cancelDrag } = useNodeDragToCanvas()

      startDrag(mockNodeDef, { mode: 'native' })
      expect(mockCanvasStore.isGhostPlacing).toBe(false)

      cancelDrag()
      expect(mockCanvasStore.isGhostPlacing).toBe(false)
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
    it('should add node when released over the canvas', () => {
      canvasElement.getBoundingClientRect.mockReturnValue(CANVAS_RECT)
      mockConvertEventToCanvasOffset.mockReturnValue([150, 150])

      const { startDrag } = useNodeDragToCanvas()
      startDrag(mockNodeDef)

      dispatchPointerUp(250, 250)

      expect(mockAddNodeOnGraph).toHaveBeenCalledWith(mockNodeDef, {
        pos: [150, 150]
      })
    })

    it('should not add node when released outside the canvas', () => {
      canvasElement.getBoundingClientRect.mockReturnValue(CANVAS_RECT)

      const { startDrag, isDragging } = useNodeDragToCanvas()
      startDrag(mockNodeDef)

      dispatchPointerUp(600, 250, panelElement)

      expect(mockAddNodeOnGraph).not.toHaveBeenCalled()
      expect(isDragging.value).toBe(false)
    })

    it('should not add node when released over a panel within canvas bounds', () => {
      canvasElement.getBoundingClientRect.mockReturnValue(CANVAS_RECT)

      const { startDrag, isDragging } = useNodeDragToCanvas()
      startDrag(mockNodeDef)

      // FE-688: the panel overlays the full-bleed canvas, so a release at a
      // point inside the canvas rect but on the panel must not place a hidden
      // node behind the panel.
      dispatchPointerUp(250, 250, panelElement)

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
      canvasElement.getBoundingClientRect.mockReturnValue(CANVAS_RECT)
      mockConvertEventToCanvasOffset.mockReturnValue([150, 150])
      const placedNode = { id: 1 }
      mockAddNodeOnGraph.mockReturnValue(placedNode)

      const { startDrag } = useNodeDragToCanvas()
      startDrag(mockNodeDef)

      dispatchPointerUp(250, 250)

      expect(mockSelectItems).toHaveBeenCalledWith([placedNode])
    })

    it('should apply the requested widget values to the placed node', () => {
      canvasElement.getBoundingClientRect.mockReturnValue(CANVAS_RECT)
      mockConvertEventToCanvasOffset.mockReturnValue([150, 150])
      const widget = { name: 'ckpt_name', value: '' }
      mockAddNodeOnGraph.mockReturnValue({ id: 1, widgets: [widget] })

      const { startDrag } = useNodeDragToCanvas()
      startDrag(mockNodeDef, {
        widgetValues: { ckpt_name: 'model.safetensors' }
      })

      dispatchPointerUp(250, 250)

      expect(widget.value).toBe('model.safetensors')
    })

    it('should warn but still place the node when a requested widget is missing', () => {
      canvasElement.getBoundingClientRect.mockReturnValue(CANVAS_RECT)
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

      dispatchPointerUp(250, 250)

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
      canvasElement.getBoundingClientRect.mockReturnValue(CANVAS_RECT)
      mockConvertEventToCanvasOffset.mockReturnValue([150, 150])
      mockAddNodeOnGraph.mockReturnValue(null)
      vi.spyOn(console, 'error').mockImplementation(() => {})

      const { startDrag } = useNodeDragToCanvas()
      startDrag(mockNodeDef)

      dispatchPointerUp(250, 250)

      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          detail: 'assetBrowser.failedToCreateNode'
        })
      )
    })

    it('should not call selectItems when graph returns no node', () => {
      canvasElement.getBoundingClientRect.mockReturnValue(CANVAS_RECT)
      mockConvertEventToCanvasOffset.mockReturnValue([150, 150])
      mockAddNodeOnGraph.mockReturnValue(null)
      vi.spyOn(console, 'error').mockImplementation(() => {})

      const { startDrag } = useNodeDragToCanvas()
      startDrag(mockNodeDef)

      dispatchPointerUp(250, 250)

      expect(mockSelectItems).not.toHaveBeenCalled()
    })

    it('should not add node on pointerup when in native drag mode', () => {
      canvasElement.getBoundingClientRect.mockReturnValue(CANVAS_RECT)
      mockConvertEventToCanvasOffset.mockReturnValue([150, 150])

      const { startDrag, isDragging } = useNodeDragToCanvas()
      startDrag(mockNodeDef, { mode: 'native' })

      dispatchPointerUp(250, 250)

      expect(mockAddNodeOnGraph).not.toHaveBeenCalled()
      expect(isDragging.value).toBe(true)
    })
  })

  describe('handleNativeDrop', () => {
    it('should add node when drop position is over canvas', () => {
      canvasElement.getBoundingClientRect.mockReturnValue(CANVAS_RECT)
      mockConvertEventToCanvasOffset.mockReturnValue([200, 200])

      const { startDrag, handleNativeDrop } = useNodeDragToCanvas()

      startDrag(mockNodeDef, { mode: 'native' })
      handleNativeDrop(250, 250)

      expect(mockAddNodeOnGraph).toHaveBeenCalledWith(mockNodeDef, {
        pos: [200, 200]
      })
    })

    it('should not add node when drop position is outside canvas', () => {
      canvasElement.getBoundingClientRect.mockReturnValue(CANVAS_RECT)

      const { startDrag, handleNativeDrop, isDragging } = useNodeDragToCanvas()

      startDrag(mockNodeDef, { mode: 'native' })
      handleNativeDrop(600, 250)

      expect(mockAddNodeOnGraph).not.toHaveBeenCalled()
      expect(isDragging.value).toBe(false)
    })

    it('should not add node when dragMode is click', () => {
      canvasElement.getBoundingClientRect.mockReturnValue(CANVAS_RECT)
      mockConvertEventToCanvasOffset.mockReturnValue([200, 200])

      const { startDrag, handleNativeDrop } = useNodeDragToCanvas()

      startDrag(mockNodeDef)
      handleNativeDrop(250, 250)

      expect(mockAddNodeOnGraph).not.toHaveBeenCalled()
    })

    it('should reset drag state after drop', () => {
      canvasElement.getBoundingClientRect.mockReturnValue(CANVAS_RECT)
      mockConvertEventToCanvasOffset.mockReturnValue([200, 200])

      const { startDrag, handleNativeDrop, isDragging } = useNodeDragToCanvas()

      startDrag(mockNodeDef, { mode: 'native' })
      handleNativeDrop(250, 250)

      expect(isDragging.value).toBe(false)
    })
  })

  describe('blockCommitPointerDown', () => {
    function dispatchPointerDown(
      x: number,
      y: number,
      target: EventTarget = canvasElement
    ) {
      const event = new PointerEvent('pointerdown', {
        clientX: x,
        clientY: y,
        bubbles: true,
        cancelable: true
      })
      const stopSpy = vi.spyOn(event, 'stopImmediatePropagation')
      target.dispatchEvent(event)
      return stopSpy
    }

    beforeEach(() => {
      canvasElement.getBoundingClientRect.mockReturnValue(CANVAS_RECT)
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

    it('should not stop propagation when pointer is over a panel', () => {
      const { startDrag } = useNodeDragToCanvas()
      startDrag(mockNodeDef)

      expect(dispatchPointerDown(250, 250, panelElement)).not.toHaveBeenCalled()
    })
  })

  describe('native drag position tracking', () => {
    beforeEach(() => {
      canvasElement.getBoundingClientRect.mockReturnValue(CANVAS_RECT)
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
