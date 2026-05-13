import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useCoordinateTransform } from '@/composables/maskeditor/useCoordinateTransform'

type MockStore = {
  pointerZone: HTMLElement | null
  canvasContainer: HTMLElement | null
  maskCanvas: HTMLCanvasElement | null
}

const mockStore: MockStore = {
  pointerZone: null,
  canvasContainer: null,
  maskCanvas: null
}

vi.mock('@/stores/maskEditorStore', () => ({
  useMaskEditorStore: vi.fn(() => mockStore)
}))

vi.mock('@vueuse/core', () => ({
  createSharedComposable: <T extends (...args: unknown[]) => unknown>(fn: T) =>
    fn
}))

const createElementWithRect = (rect: Partial<DOMRect>): HTMLElement => {
  const el = document.createElement('div')
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
    ...rect
  } as DOMRect)
  return el
}

const createCanvasWithRect = (
  rect: Partial<DOMRect>,
  width: number,
  height: number
): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
    ...rect
  } as DOMRect)
  return canvas
}

describe('useCoordinateTransform', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStore.pointerZone = null
    mockStore.canvasContainer = null
    mockStore.maskCanvas = null
  })

  describe('screenToCanvas', () => {
    it('should return canvas coordinates when display size matches canvas size', () => {
      mockStore.pointerZone = createElementWithRect({
        left: 100,
        top: 50,
        width: 200,
        height: 200
      })
      mockStore.canvasContainer = createElementWithRect({
        left: 100,
        top: 50,
        width: 200,
        height: 200
      })
      mockStore.maskCanvas = createCanvasWithRect(
        { left: 100, top: 50, width: 200, height: 200 },
        200,
        200
      )

      const transform = useCoordinateTransform()

      expect(transform.screenToCanvas({ x: 50, y: 30 })).toEqual({
        x: 50,
        y: 30
      })
    })

    it('should apply scale when canvas is rendered smaller than its bitmap', () => {
      mockStore.pointerZone = createElementWithRect({
        left: 0,
        top: 0,
        width: 100,
        height: 100
      })
      mockStore.canvasContainer = createElementWithRect({
        left: 0,
        top: 0,
        width: 100,
        height: 100
      })
      mockStore.maskCanvas = createCanvasWithRect(
        { left: 0, top: 0, width: 100, height: 100 },
        400,
        400
      )

      const transform = useCoordinateTransform()

      expect(transform.screenToCanvas({ x: 25, y: 50 })).toEqual({
        x: 100,
        y: 200
      })
    })

    it('should account for pointerZone offset relative to canvasContainer', () => {
      mockStore.pointerZone = createElementWithRect({
        left: 200,
        top: 100,
        width: 200,
        height: 200
      })
      mockStore.canvasContainer = createElementWithRect({
        left: 150,
        top: 80,
        width: 200,
        height: 200
      })
      mockStore.maskCanvas = createCanvasWithRect(
        { left: 150, top: 80, width: 200, height: 200 },
        200,
        200
      )

      const transform = useCoordinateTransform()

      expect(transform.screenToCanvas({ x: 0, y: 0 })).toEqual({
        x: 50,
        y: 20
      })
    })

    it('should support non-uniform scale factors', () => {
      mockStore.pointerZone = createElementWithRect({
        left: 0,
        top: 0,
        width: 100,
        height: 50
      })
      mockStore.canvasContainer = createElementWithRect({
        left: 0,
        top: 0,
        width: 100,
        height: 50
      })
      mockStore.maskCanvas = createCanvasWithRect(
        { left: 0, top: 0, width: 100, height: 50 },
        200,
        200
      )

      const transform = useCoordinateTransform()

      expect(transform.screenToCanvas({ x: 10, y: 10 })).toEqual({
        x: 20,
        y: 40
      })
    })

    it('should return zero point and warn when pointerZone is missing', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      mockStore.canvasContainer = createElementWithRect({})
      mockStore.maskCanvas = createCanvasWithRect({}, 100, 100)

      const transform = useCoordinateTransform()

      expect(transform.screenToCanvas({ x: 10, y: 20 })).toEqual({ x: 0, y: 0 })
      expect(warnSpy).toHaveBeenCalledWith(
        'screenToCanvas called before elements are available'
      )

      warnSpy.mockRestore()
    })

    it('should return zero point when canvasContainer is missing', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      mockStore.pointerZone = createElementWithRect({})
      mockStore.maskCanvas = createCanvasWithRect({}, 100, 100)

      const transform = useCoordinateTransform()

      expect(transform.screenToCanvas({ x: 10, y: 20 })).toEqual({ x: 0, y: 0 })
      expect(warnSpy).toHaveBeenCalled()

      warnSpy.mockRestore()
    })

    it('should return zero point when maskCanvas is missing', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      mockStore.pointerZone = createElementWithRect({})
      mockStore.canvasContainer = createElementWithRect({})

      const transform = useCoordinateTransform()

      expect(transform.screenToCanvas({ x: 10, y: 20 })).toEqual({ x: 0, y: 0 })
      expect(warnSpy).toHaveBeenCalled()

      warnSpy.mockRestore()
    })
  })

  describe('canvasToScreen', () => {
    it('should return pointerZone-relative coordinates when display matches bitmap', () => {
      mockStore.pointerZone = createElementWithRect({
        left: 100,
        top: 50,
        width: 200,
        height: 200
      })
      mockStore.canvasContainer = createElementWithRect({
        left: 100,
        top: 50,
        width: 200,
        height: 200
      })
      mockStore.maskCanvas = createCanvasWithRect(
        { left: 100, top: 50, width: 200, height: 200 },
        200,
        200
      )

      const transform = useCoordinateTransform()

      expect(transform.canvasToScreen({ x: 50, y: 30 })).toEqual({
        x: 50,
        y: 30
      })
    })

    it('should apply inverse scale when canvas bitmap is larger than display', () => {
      mockStore.pointerZone = createElementWithRect({
        left: 0,
        top: 0,
        width: 100,
        height: 100
      })
      mockStore.canvasContainer = createElementWithRect({
        left: 0,
        top: 0,
        width: 100,
        height: 100
      })
      mockStore.maskCanvas = createCanvasWithRect(
        { left: 0, top: 0, width: 100, height: 100 },
        400,
        400
      )

      const transform = useCoordinateTransform()

      expect(transform.canvasToScreen({ x: 100, y: 200 })).toEqual({
        x: 25,
        y: 50
      })
    })

    it('should account for pointerZone offset relative to canvasContainer', () => {
      mockStore.pointerZone = createElementWithRect({
        left: 200,
        top: 100,
        width: 200,
        height: 200
      })
      mockStore.canvasContainer = createElementWithRect({
        left: 150,
        top: 80,
        width: 200,
        height: 200
      })
      mockStore.maskCanvas = createCanvasWithRect(
        { left: 150, top: 80, width: 200, height: 200 },
        200,
        200
      )

      const transform = useCoordinateTransform()

      expect(transform.canvasToScreen({ x: 50, y: 20 })).toEqual({ x: 0, y: 0 })
    })

    it('should round-trip with screenToCanvas', () => {
      mockStore.pointerZone = createElementWithRect({
        left: 50,
        top: 25,
        width: 300,
        height: 300
      })
      mockStore.canvasContainer = createElementWithRect({
        left: 70,
        top: 40,
        width: 300,
        height: 300
      })
      mockStore.maskCanvas = createCanvasWithRect(
        { left: 70, top: 40, width: 300, height: 300 },
        600,
        600
      )

      const transform = useCoordinateTransform()
      const original = { x: 123, y: 87 }

      const canvasPoint = transform.screenToCanvas(original)
      const back = transform.canvasToScreen(canvasPoint)

      expect(back.x).toBeCloseTo(original.x)
      expect(back.y).toBeCloseTo(original.y)
    })

    it('should return zero point and warn when pointerZone is missing', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      mockStore.canvasContainer = createElementWithRect({})
      mockStore.maskCanvas = createCanvasWithRect({}, 100, 100)

      const transform = useCoordinateTransform()

      expect(transform.canvasToScreen({ x: 10, y: 20 })).toEqual({ x: 0, y: 0 })
      expect(warnSpy).toHaveBeenCalledWith(
        'canvasToScreen called before elements are available'
      )

      warnSpy.mockRestore()
    })

    it('should return zero point when canvasContainer is missing', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      mockStore.pointerZone = createElementWithRect({})
      mockStore.maskCanvas = createCanvasWithRect({}, 100, 100)

      const transform = useCoordinateTransform()

      expect(transform.canvasToScreen({ x: 10, y: 20 })).toEqual({ x: 0, y: 0 })
      expect(warnSpy).toHaveBeenCalled()

      warnSpy.mockRestore()
    })

    it('should return zero point when maskCanvas is missing', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      mockStore.pointerZone = createElementWithRect({})
      mockStore.canvasContainer = createElementWithRect({})

      const transform = useCoordinateTransform()

      expect(transform.canvasToScreen({ x: 10, y: 20 })).toEqual({ x: 0, y: 0 })
      expect(warnSpy).toHaveBeenCalled()

      warnSpy.mockRestore()
    })
  })
})
