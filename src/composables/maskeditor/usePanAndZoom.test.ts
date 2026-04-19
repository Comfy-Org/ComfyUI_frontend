import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { usePanAndZoom } from '@/composables/maskeditor/usePanAndZoom'

interface IMockStore {
  canvasContainer: HTMLElement | null
  maskCanvas: HTMLCanvasElement | null
  rgbCanvas: HTMLCanvasElement | null
  isPanning: boolean
  brushVisible: boolean
  displayZoomRatio: number
  resetZoomTrigger: number
  canvasHistory: { undo: ReturnType<typeof vi.fn> }
  setCursorPoint: ReturnType<typeof vi.fn>
  setPanOffset: ReturnType<typeof vi.fn>
  setZoomRatio: ReturnType<typeof vi.fn>
}

const { mockStore } = vi.hoisted(() => {
  const mockStore: IMockStore = {
    canvasContainer: null,
    maskCanvas: null,
    rgbCanvas: null,
    isPanning: false,
    brushVisible: true,
    displayZoomRatio: 1,
    resetZoomTrigger: 0,
    canvasHistory: { undo: vi.fn() },
    setCursorPoint: vi.fn(),
    setPanOffset: vi.fn(),
    setZoomRatio: vi.fn()
  }
  return { mockStore }
})

vi.mock('@/stores/maskEditorStore', () => ({
  useMaskEditorStore: vi.fn(() => mockStore)
}))

function createMockElement(overrides: Partial<HTMLElement> = {}): HTMLElement {
  return {
    clientWidth: 1200,
    clientHeight: 800,
    style: {} as CSSStyleDeclaration,
    getBoundingClientRect: () =>
      ({
        left: 0,
        top: 0,
        width: 1200,
        height: 800,
        right: 1200,
        bottom: 800
      }) as DOMRect,
    ...overrides
  } as unknown as HTMLElement
}

function createMockCanvas(width: number, height: number): HTMLCanvasElement {
  return {
    width,
    height,
    clientWidth: width,
    clientHeight: height,
    style: {} as CSSStyleDeclaration,
    getBoundingClientRect: () =>
      ({
        left: 0,
        top: 0,
        width,
        height,
        right: width,
        bottom: height
      }) as DOMRect
  } as unknown as HTMLCanvasElement
}

function createMockImage(width: number, height: number): HTMLImageElement {
  return { width, height } as HTMLImageElement
}

function createPointerEvent(
  overrides: Partial<PointerEvent> = {}
): PointerEvent {
  return {
    clientX: 0,
    clientY: 0,
    ...overrides
  } as PointerEvent
}

function createWheelEvent(overrides: Partial<WheelEvent> = {}): WheelEvent {
  return {
    clientX: 400,
    clientY: 300,
    deltaY: -100,
    ...overrides
  } as WheelEvent
}

function createTouchList(...points: { x: number; y: number }[]): TouchList {
  const touches = points.map((p) => ({ clientX: p.x, clientY: p.y }) as Touch)
  return Object.assign(touches, {
    length: touches.length,
    item: (i: number) => touches[i]
  }) as unknown as TouchList
}

function createTouchEvent(
  touches: TouchList,
  overrides: Partial<TouchEvent> = {}
): TouchEvent {
  return {
    touches,
    preventDefault: vi.fn(),
    ...overrides
  } as unknown as TouchEvent
}

describe('usePanAndZoom', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createTestingPinia({ stubActions: false }))

    mockStore.canvasContainer = null
    mockStore.maskCanvas = null
    mockStore.rgbCanvas = null
    mockStore.isPanning = false
    mockStore.brushVisible = true
    mockStore.displayZoomRatio = 1
    mockStore.resetZoomTrigger = 0
  })

  describe('initializeCanvasPanZoom', () => {
    it('calculates zoom to fit a landscape image', async () => {
      const pz = usePanAndZoom()
      const img = createMockImage(1000, 500)
      const root = createMockElement({
        clientWidth: 1200,
        clientHeight: 800
      })
      const container = createMockElement()
      mockStore.canvasContainer = container as unknown as HTMLElement

      await pz.initializeCanvasPanZoom(img, root)

      expect(mockStore.setZoomRatio).toHaveBeenCalled()
      const zoomArg = vi.mocked(mockStore.setZoomRatio).mock.calls[0][0]
      expect(zoomArg).toBeGreaterThan(0)
      expect(zoomArg).toBeLessThanOrEqual(1)
    })

    it('calculates zoom to fit a portrait image', async () => {
      const pz = usePanAndZoom()
      const img = createMockImage(500, 1000)
      const root = createMockElement({
        clientWidth: 1200,
        clientHeight: 800
      })
      const container = createMockElement()
      mockStore.canvasContainer = container as unknown as HTMLElement

      await pz.initializeCanvasPanZoom(img, root)

      expect(mockStore.setZoomRatio).toHaveBeenCalled()
      const zoomArg = vi.mocked(mockStore.setZoomRatio).mock.calls[0][0]
      expect(zoomArg).toBeGreaterThan(0)
    })

    it('accounts for tool and side panel widths', async () => {
      const pz = usePanAndZoom()
      const img = createMockImage(800, 600)
      const root = createMockElement({
        clientWidth: 1200,
        clientHeight: 800
      })
      const toolPanel = createMockElement()
      vi.spyOn(toolPanel, 'getBoundingClientRect').mockReturnValue({
        width: 64,
        height: 800
      } as DOMRect)
      const sidePanel = createMockElement()
      vi.spyOn(sidePanel, 'getBoundingClientRect').mockReturnValue({
        width: 220,
        height: 800
      } as DOMRect)
      const container = createMockElement()
      mockStore.canvasContainer = container as unknown as HTMLElement

      await pz.initializeCanvasPanZoom(img, root, toolPanel, sidePanel)

      expect(mockStore.setPanOffset).toHaveBeenCalled()
      const offset = vi.mocked(mockStore.setPanOffset).mock.calls[0][0]
      expect(offset.x).toBeGreaterThanOrEqual(64)
    })

    it('calls invalidatePanZoom to apply styles', async () => {
      const pz = usePanAndZoom()
      const img = createMockImage(800, 600)
      const root = createMockElement()
      const container = createMockElement()
      mockStore.canvasContainer = container as unknown as HTMLElement

      await pz.initializeCanvasPanZoom(img, root)

      expect(mockStore.setPanOffset).toHaveBeenCalled()
      expect(mockStore.setZoomRatio).toHaveBeenCalled()
    })
  })

  describe('handlePanStart / handlePanMove', () => {
    it('sets isPanning and records initial position', () => {
      const pz = usePanAndZoom()
      pz.handlePanStart(createPointerEvent({ clientX: 100, clientY: 200 }))

      expect(mockStore.isPanning).toBe(true)
    })

    it('updates pan offset on move', async () => {
      const pz = usePanAndZoom()
      const img = createMockImage(800, 600)
      const root = createMockElement()
      const container = createMockElement()
      mockStore.canvasContainer = container as unknown as HTMLElement
      await pz.initializeCanvasPanZoom(img, root)

      vi.clearAllMocks()

      pz.handlePanStart(createPointerEvent({ clientX: 100, clientY: 200 }))
      await pz.handlePanMove(createPointerEvent({ clientX: 150, clientY: 250 }))

      expect(mockStore.setPanOffset).toHaveBeenCalled()
    })

    it('throws if handlePanMove called without handlePanStart', async () => {
      const pz = usePanAndZoom()
      await expect(
        pz.handlePanMove(createPointerEvent({ clientX: 0, clientY: 0 }))
      ).rejects.toThrow('mouseDownPoint is null')
    })
  })

  describe('zoom (wheel)', () => {
    it('zooms in on scroll up (negative deltaY)', async () => {
      const pz = usePanAndZoom()
      const img = createMockImage(800, 600)
      const root = createMockElement()
      const container = createMockElement()
      const canvas = createMockCanvas(800, 600)
      mockStore.canvasContainer = container as unknown as HTMLElement
      mockStore.maskCanvas = canvas

      await pz.initializeCanvasPanZoom(img, root)
      vi.clearAllMocks()

      await pz.zoom(createWheelEvent({ deltaY: -100 }))

      expect(mockStore.setZoomRatio).toHaveBeenCalled()
    })

    it('zooms out on scroll down (positive deltaY)', async () => {
      const pz = usePanAndZoom()
      const img = createMockImage(800, 600)
      const root = createMockElement()
      const container = createMockElement()
      const canvas = createMockCanvas(800, 600)
      mockStore.canvasContainer = container as unknown as HTMLElement
      mockStore.maskCanvas = canvas

      await pz.initializeCanvasPanZoom(img, root)
      vi.clearAllMocks()

      await pz.zoom(createWheelEvent({ deltaY: 100 }))

      expect(mockStore.setZoomRatio).toHaveBeenCalled()
    })

    it('clamps zoom between 0.2 and 10.0', async () => {
      const pz = usePanAndZoom()
      const img = createMockImage(800, 600)
      const root = createMockElement()
      const container = createMockElement()
      const canvas = createMockCanvas(800, 600)
      mockStore.canvasContainer = container as unknown as HTMLElement
      mockStore.maskCanvas = canvas

      await pz.initializeCanvasPanZoom(img, root)

      // Zoom out many times to hit minimum
      for (let i = 0; i < 50; i++) {
        await pz.zoom(createWheelEvent({ deltaY: 100 }))
      }

      const lastCall = vi.mocked(mockStore.setZoomRatio).mock.calls.at(-1)!
      expect(lastCall[0]).toBeGreaterThanOrEqual(0.2)
    })

    it('returns early if maskCanvas is unavailable', async () => {
      const pz = usePanAndZoom()
      const img = createMockImage(800, 600)
      const root = createMockElement()
      const container = createMockElement()
      mockStore.canvasContainer = container as unknown as HTMLElement
      mockStore.maskCanvas = null

      await pz.initializeCanvasPanZoom(img, root)
      vi.clearAllMocks()

      await pz.zoom(createWheelEvent())

      expect(mockStore.setPanOffset).not.toHaveBeenCalled()
    })

    it('updates cursor position after zooming', async () => {
      const pz = usePanAndZoom()
      const img = createMockImage(800, 600)
      const root = createMockElement()
      const container = createMockElement()
      const canvas = createMockCanvas(800, 600)
      mockStore.canvasContainer = container as unknown as HTMLElement
      mockStore.maskCanvas = canvas

      await pz.initializeCanvasPanZoom(img, root)
      vi.clearAllMocks()

      await pz.zoom(
        createWheelEvent({ clientX: 300, clientY: 200, deltaY: -100 })
      )

      expect(mockStore.setCursorPoint).toHaveBeenCalled()
    })
  })

  describe('updateCursorPosition', () => {
    it('sets cursor point offset by pan', async () => {
      const pz = usePanAndZoom()
      const img = createMockImage(800, 600)
      const root = createMockElement()
      const container = createMockElement()
      mockStore.canvasContainer = container as unknown as HTMLElement
      await pz.initializeCanvasPanZoom(img, root)
      vi.clearAllMocks()

      pz.updateCursorPosition({ x: 500, y: 400 })

      expect(mockStore.setCursorPoint).toHaveBeenCalled()
    })
  })

  describe('invalidatePanZoom', () => {
    it('returns early when image is missing', async () => {
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {})
      const pz = usePanAndZoom()

      await pz.invalidatePanZoom()

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Missing required properties for pan/zoom'
      )
      consoleWarnSpy.mockRestore()
    })

    it('applies container dimensions from store when local ref is null', async () => {
      const pz = usePanAndZoom()
      const img = createMockImage(800, 600)
      const root = createMockElement()
      const container = createMockElement()
      mockStore.canvasContainer = container as unknown as HTMLElement

      await pz.initializeCanvasPanZoom(img, root)

      expect(mockStore.setPanOffset).toHaveBeenCalled()
      expect(mockStore.setZoomRatio).toHaveBeenCalled()
    })

    it('syncs rgbCanvas dimensions when they differ from image', async () => {
      const pz = usePanAndZoom()
      const img = createMockImage(800, 600)
      const root = createMockElement()
      const container = createMockElement()
      const rgbCanvas = createMockCanvas(400, 300)
      mockStore.canvasContainer = container as unknown as HTMLElement
      mockStore.rgbCanvas = rgbCanvas

      await pz.initializeCanvasPanZoom(img, root)

      expect(rgbCanvas.width).toBe(800)
      expect(rgbCanvas.height).toBe(600)
    })
  })

  describe('touch handlers', () => {
    it('handleTouchStart with single touch records the touch point', () => {
      const pz = usePanAndZoom()
      const touches = createTouchList({ x: 100, y: 200 })
      const event = createTouchEvent(touches)

      pz.handleTouchStart(event)

      expect(event.preventDefault).toHaveBeenCalled()
      expect(mockStore.brushVisible).toBe(false)
    })

    it('handleTouchStart with two touches enters zoom mode', () => {
      const pz = usePanAndZoom()
      const touches = createTouchList({ x: 100, y: 200 }, { x: 300, y: 200 })
      const event = createTouchEvent(touches)

      pz.handleTouchStart(event)

      expect(event.preventDefault).toHaveBeenCalled()
    })

    it('handleTouchStart double-tap with two fingers triggers undo', () => {
      vi.useFakeTimers()
      const pz = usePanAndZoom()

      const touches = createTouchList({ x: 100, y: 200 }, { x: 300, y: 200 })
      // First tap
      pz.handleTouchStart(createTouchEvent(touches))
      vi.advanceTimersByTime(100)
      // Second tap within DOUBLE_TAP_DELAY
      pz.handleTouchStart(createTouchEvent(touches))

      expect(mockStore.canvasHistory.undo).toHaveBeenCalled()

      vi.useRealTimers()
    })

    it('handleTouchStart ignores touches when pen is active', () => {
      const pz = usePanAndZoom()
      pz.addPenPointerId(1)

      const touches = createTouchList({ x: 100, y: 200 })
      const event = createTouchEvent(touches)
      pz.handleTouchStart(event)

      // brushVisible should not change since pen is active
      expect(mockStore.brushVisible).toBe(true)
    })

    it('handleTouchMove with single touch pans the canvas', async () => {
      const pz = usePanAndZoom()
      const img = createMockImage(800, 600)
      const root = createMockElement()
      const container = createMockElement()
      mockStore.canvasContainer = container as unknown as HTMLElement
      await pz.initializeCanvasPanZoom(img, root)

      // Start with single touch
      const startTouches = createTouchList({ x: 100, y: 200 })
      pz.handleTouchStart(createTouchEvent(startTouches))

      vi.clearAllMocks()

      // Move touch
      const moveTouches = createTouchList({ x: 150, y: 250 })
      await pz.handleTouchMove(createTouchEvent(moveTouches))

      expect(mockStore.setPanOffset).toHaveBeenCalled()
    })

    it('handleTouchMove with two touches performs pinch zoom', async () => {
      const pz = usePanAndZoom()
      const img = createMockImage(800, 600)
      const root = createMockElement()
      const container = createMockElement()
      const canvas = createMockCanvas(800, 600)
      mockStore.canvasContainer = container as unknown as HTMLElement
      mockStore.maskCanvas = canvas
      await pz.initializeCanvasPanZoom(img, root)

      // Start two-finger touch
      const startTouches = createTouchList(
        { x: 200, y: 300 },
        { x: 400, y: 300 }
      )
      pz.handleTouchStart(createTouchEvent(startTouches))

      vi.clearAllMocks()

      // Move fingers apart (zoom in)
      const moveTouches = createTouchList(
        { x: 150, y: 300 },
        { x: 450, y: 300 }
      )
      await pz.handleTouchMove(createTouchEvent(moveTouches))

      expect(mockStore.setZoomRatio).toHaveBeenCalled()
    })

    it('handleTouchMove ignores when pen is active', async () => {
      const pz = usePanAndZoom()
      pz.addPenPointerId(1)

      const touches = createTouchList({ x: 100, y: 200 })
      const event = createTouchEvent(touches)
      await pz.handleTouchMove(event)

      expect(mockStore.setPanOffset).not.toHaveBeenCalled()
    })

    it('handleTouchEnd with remaining touch updates lastTouchPoint', () => {
      const pz = usePanAndZoom()
      const remainingTouches = createTouchList({ x: 200, y: 300 })
      const event = createTouchEvent(remainingTouches)

      pz.handleTouchEnd(event)

      expect(event.preventDefault).toHaveBeenCalled()
    })

    it('handleTouchEnd with no remaining touches resets zoom state', () => {
      const pz = usePanAndZoom()
      const emptyTouches = createTouchList()
      const event = createTouchEvent(emptyTouches)

      pz.handleTouchEnd(event)

      expect(event.preventDefault).toHaveBeenCalled()
    })
  })

  describe('addPenPointerId / removePenPointerId', () => {
    it('adds a pen pointer id', () => {
      const pz = usePanAndZoom()
      pz.addPenPointerId(5)

      // Pen blocks touch — verify by attempting a touch start
      const touches = createTouchList({ x: 0, y: 0 })
      pz.handleTouchStart(createTouchEvent(touches))
      expect(mockStore.brushVisible).toBe(true)
    })

    it('does not add duplicate pointer ids', () => {
      const pz = usePanAndZoom()
      pz.addPenPointerId(5)
      pz.addPenPointerId(5)

      // Remove once — should fully clear
      pz.removePenPointerId(5)

      const touches = createTouchList({ x: 0, y: 0 })
      pz.handleTouchStart(createTouchEvent(touches))
      expect(mockStore.brushVisible).toBe(false)
    })

    it('removes a pen pointer id', () => {
      const pz = usePanAndZoom()
      pz.addPenPointerId(5)
      pz.removePenPointerId(5)

      const touches = createTouchList({ x: 0, y: 0 })
      pz.handleTouchStart(createTouchEvent(touches))
      expect(mockStore.brushVisible).toBe(false)
    })

    it('no-ops when removing a non-existent id', () => {
      const pz = usePanAndZoom()
      pz.removePenPointerId(999)

      const touches = createTouchList({ x: 0, y: 0 })
      pz.handleTouchStart(createTouchEvent(touches))
      expect(mockStore.brushVisible).toBe(false)
    })
  })
})
