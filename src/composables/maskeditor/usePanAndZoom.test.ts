import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

function createMockElement(width = 1200, height = 800): HTMLElement {
  return {
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

function createTouchList(...points: { x: number; y: number }[]): TouchList {
  const touches = points.map((p) => ({ clientX: p.x, clientY: p.y }) as Touch)
  return Object.assign(touches, {
    length: touches.length,
    item: (i: number) => touches[i]
  }) as unknown as TouchList
}

function createTouchEvent(touches: TouchList): TouchEvent {
  return {
    touches,
    preventDefault: vi.fn()
  } as unknown as TouchEvent
}

async function initComposable() {
  const pz = usePanAndZoom()
  const img = createMockImage(800, 600)
  const root = createMockElement()
  const container = createMockElement()
  const canvas = createMockCanvas(800, 600)
  mockStore.canvasContainer = container as unknown as HTMLElement
  mockStore.maskCanvas = canvas
  await pz.initializeCanvasPanZoom(img, root)
  vi.clearAllMocks()
  return { pz, canvas }
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

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('initializeCanvasPanZoom', () => {
    it('sets zoom and pan on the store', async () => {
      const pz = usePanAndZoom()
      const container = createMockElement()
      mockStore.canvasContainer = container as unknown as HTMLElement

      await pz.initializeCanvasPanZoom(
        createMockImage(800, 600),
        createMockElement()
      )

      expect(mockStore.setZoomRatio).toHaveBeenCalledOnce()
      expect(mockStore.setPanOffset).toHaveBeenCalledOnce()

      const zoom = vi.mocked(mockStore.setZoomRatio).mock.calls[0][0]
      expect(zoom).toBeGreaterThan(0)
    })

    it('accounts for panel widths via setPanOffset', async () => {
      const pz = usePanAndZoom()
      mockStore.canvasContainer = createMockElement() as unknown as HTMLElement

      const toolPanel = createMockElement()
      vi.spyOn(toolPanel, 'getBoundingClientRect').mockReturnValue({
        width: 64
      } as DOMRect)
      const sidePanel = createMockElement()
      vi.spyOn(sidePanel, 'getBoundingClientRect').mockReturnValue({
        width: 220
      } as DOMRect)

      await pz.initializeCanvasPanZoom(
        createMockImage(800, 600),
        createMockElement(),
        toolPanel,
        sidePanel
      )

      const offset = vi.mocked(mockStore.setPanOffset).mock.calls[0][0]
      expect(offset.x).toBeGreaterThanOrEqual(64)
    })

    it('syncs rgbCanvas dimensions when they differ', async () => {
      const pz = usePanAndZoom()
      const rgbCanvas = createMockCanvas(400, 300)
      mockStore.canvasContainer = createMockElement() as unknown as HTMLElement
      mockStore.rgbCanvas = rgbCanvas

      await pz.initializeCanvasPanZoom(
        createMockImage(800, 600),
        createMockElement()
      )

      expect(rgbCanvas.width).toBe(800)
      expect(rgbCanvas.height).toBe(600)
    })
  })

  describe('handlePanStart / handlePanMove', () => {
    it('sets isPanning on the store', () => {
      const pz = usePanAndZoom()
      pz.handlePanStart({ clientX: 100, clientY: 200 } as PointerEvent)
      expect(mockStore.isPanning).toBe(true)
    })

    it('updates pan offset on move', async () => {
      const { pz } = await initComposable()

      pz.handlePanStart({ clientX: 100, clientY: 200 } as PointerEvent)
      await pz.handlePanMove({
        clientX: 150,
        clientY: 250
      } as PointerEvent)

      expect(mockStore.setPanOffset).toHaveBeenCalled()
    })

    it('throws if move called without start', async () => {
      const pz = usePanAndZoom()
      await expect(
        pz.handlePanMove({ clientX: 0, clientY: 0 } as PointerEvent)
      ).rejects.toThrow('mouseDownPoint is null')
    })
  })

  describe('zoom', () => {
    it('zooms in with negative deltaY and updates store', async () => {
      const { pz } = await initComposable()
      const initialZoom = vi.mocked(mockStore.setZoomRatio).mock.calls[0]?.[0]

      await pz.zoom({
        clientX: 400,
        clientY: 300,
        deltaY: -100
      } as WheelEvent)

      const zoomValue = vi.mocked(mockStore.setZoomRatio).mock.calls[0][0]
      expect(zoomValue).toBeGreaterThan(initialZoom ?? 0)
    })

    it('zooms out with positive deltaY producing smaller zoom', async () => {
      const { pz } = await initComposable()

      await pz.zoom({
        clientX: 400,
        clientY: 300,
        deltaY: -100
      } as WheelEvent)

      const zoomIn = vi.mocked(mockStore.setZoomRatio).mock.calls[0][0]
      vi.clearAllMocks()

      await pz.zoom({
        clientX: 400,
        clientY: 300,
        deltaY: 100
      } as WheelEvent)

      const zoomOut = vi.mocked(mockStore.setZoomRatio).mock.calls[0][0]
      expect(zoomOut).toBeLessThan(zoomIn)
    })

    it('clamps zoom at lower bound after many zoom-outs', async () => {
      const { pz } = await initComposable()

      for (let i = 0; i < 50; i++) {
        await pz.zoom({
          clientX: 400,
          clientY: 300,
          deltaY: 100
        } as WheelEvent)
      }

      const calls = mockStore.setZoomRatio.mock.calls
      expect(calls[calls.length - 1][0]).toBeGreaterThanOrEqual(0.2)
    })

    it('clamps zoom at upper bound after many zoom-ins', async () => {
      const { pz } = await initComposable()

      for (let i = 0; i < 100; i++) {
        await pz.zoom({
          clientX: 400,
          clientY: 300,
          deltaY: -100
        } as WheelEvent)
      }

      const calls = mockStore.setZoomRatio.mock.calls
      expect(calls[calls.length - 1][0]).toBeLessThanOrEqual(10)
    })

    it('returns early when maskCanvas is null', async () => {
      const pz = usePanAndZoom()
      const container = createMockElement()
      mockStore.canvasContainer = container as unknown as HTMLElement
      mockStore.maskCanvas = null
      await pz.initializeCanvasPanZoom(
        createMockImage(800, 600),
        createMockElement()
      )
      vi.clearAllMocks()

      await pz.zoom({
        clientX: 400,
        clientY: 300,
        deltaY: -100
      } as WheelEvent)

      expect(mockStore.setPanOffset).not.toHaveBeenCalled()
    })

    it('updates cursor position after zooming', async () => {
      const { pz } = await initComposable()

      await pz.zoom({
        clientX: 300,
        clientY: 200,
        deltaY: -100
      } as WheelEvent)

      expect(mockStore.setCursorPoint).toHaveBeenCalled()
    })
  })

  describe('updateCursorPosition', () => {
    it('calls store.setCursorPoint', async () => {
      const { pz } = await initComposable()

      pz.updateCursorPosition({ x: 500, y: 400 })

      expect(mockStore.setCursorPoint).toHaveBeenCalled()
    })
  })

  describe('invalidatePanZoom', () => {
    it('warns and returns early when image is missing', async () => {
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {})

      try {
        const pz = usePanAndZoom()
        await pz.invalidatePanZoom()
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          'Missing required properties for pan/zoom'
        )
      } finally {
        consoleWarnSpy.mockRestore()
      }
    })
  })

  describe('touch handlers', () => {
    it('sets brushVisible false on single touch', () => {
      const pz = usePanAndZoom()
      pz.handleTouchStart(createTouchEvent(createTouchList({ x: 1, y: 2 })))
      expect(mockStore.brushVisible).toBe(false)
    })

    it('ignores touch when pen pointer is active', () => {
      const pz = usePanAndZoom()
      pz.addPenPointerId(1)
      pz.handleTouchStart(createTouchEvent(createTouchList({ x: 1, y: 2 })))
      expect(mockStore.brushVisible).toBe(true)
    })

    it('triggers undo on two-finger double-tap', () => {
      vi.useFakeTimers()

      try {
        const pz = usePanAndZoom()
        const touches = createTouchList({ x: 100, y: 200 }, { x: 300, y: 200 })

        pz.handleTouchStart(createTouchEvent(touches))
        vi.advanceTimersByTime(100)
        pz.handleTouchStart(createTouchEvent(touches))

        expect(mockStore.canvasHistory.undo).toHaveBeenCalled()
      } finally {
        vi.useRealTimers()
      }
    })

    it('single-touch move pans the canvas', async () => {
      const { pz } = await initComposable()

      pz.handleTouchStart(createTouchEvent(createTouchList({ x: 100, y: 200 })))
      vi.clearAllMocks()

      await pz.handleTouchMove(
        createTouchEvent(createTouchList({ x: 150, y: 250 }))
      )

      expect(mockStore.setPanOffset).toHaveBeenCalled()
    })

    it('two-finger move performs pinch zoom', async () => {
      const { pz } = await initComposable()

      pz.handleTouchStart(
        createTouchEvent(
          createTouchList({ x: 200, y: 300 }, { x: 400, y: 300 })
        )
      )
      vi.clearAllMocks()

      await pz.handleTouchMove(
        createTouchEvent(
          createTouchList({ x: 150, y: 300 }, { x: 450, y: 300 })
        )
      )

      expect(mockStore.setZoomRatio).toHaveBeenCalled()
    })

    it('touch move is ignored when pen is active', async () => {
      const pz = usePanAndZoom()
      pz.addPenPointerId(1)

      await pz.handleTouchMove(
        createTouchEvent(createTouchList({ x: 100, y: 200 }))
      )

      expect(mockStore.setPanOffset).not.toHaveBeenCalled()
    })

    it('handleTouchEnd calls preventDefault', () => {
      const pz = usePanAndZoom()
      const event = createTouchEvent(createTouchList({ x: 200, y: 300 }))
      pz.handleTouchEnd(event)
      expect(event.preventDefault).toHaveBeenCalled()
    })
  })

  describe('pen pointer management', () => {
    it('blocks touch input while pen is active', () => {
      const pz = usePanAndZoom()
      pz.addPenPointerId(5)

      pz.handleTouchStart(createTouchEvent(createTouchList({ x: 0, y: 0 })))
      expect(mockStore.brushVisible).toBe(true)
    })

    it('does not add duplicate ids', () => {
      const pz = usePanAndZoom()
      pz.addPenPointerId(5)
      pz.addPenPointerId(5)
      pz.removePenPointerId(5)

      pz.handleTouchStart(createTouchEvent(createTouchList({ x: 0, y: 0 })))
      expect(mockStore.brushVisible).toBe(false)
    })

    it('re-enables touch after removing pen id', () => {
      const pz = usePanAndZoom()
      pz.addPenPointerId(5)
      pz.removePenPointerId(5)

      pz.handleTouchStart(createTouchEvent(createTouchList({ x: 0, y: 0 })))
      expect(mockStore.brushVisible).toBe(false)
    })

    it('no-ops when removing non-existent id', () => {
      const pz = usePanAndZoom()
      pz.removePenPointerId(999)

      pz.handleTouchStart(createTouchEvent(createTouchList({ x: 0, y: 0 })))
      expect(mockStore.brushVisible).toBe(false)
    })
  })
})
