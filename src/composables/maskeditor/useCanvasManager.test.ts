import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useCanvasManager } from '@/composables/maskeditor/useCanvasManager'
import { MaskBlendMode } from '@/extensions/core/maskeditor/types'

interface MockCanvasStyle {
  mixBlendMode: string
  opacity: string
  backgroundColor: string
}

interface MockCanvas {
  width: number
  height: number
  style: Partial<MockCanvasStyle>
}

interface MockContext {
  drawImage: ReturnType<typeof vi.fn>
  getImageData?: ReturnType<typeof vi.fn>
  putImageData?: ReturnType<typeof vi.fn>
  globalCompositeOperation?: string
  fillStyle?: string
}

interface MockStore {
  imgCanvas: MockCanvas | null
  maskCanvas: MockCanvas | null
  rgbCanvas: MockCanvas | null
  imgCtx: MockContext | null
  maskCtx: MockContext | null
  rgbCtx: MockContext | null
  canvasBackground: { style: Partial<MockCanvasStyle> } | null
  maskColor: { r: number; g: number; b: number }
  maskBlendMode: MaskBlendMode
  maskOpacity: number
}

const {
  mockStore,
  getImgCanvas,
  getMaskCanvas,
  getRgbCanvas,
  getImgCtx,
  getMaskCtx,
  getRgbCtx,
  getCanvasBackground
} = vi.hoisted(() => {
  const mockStore: MockStore = {
    imgCanvas: null,
    maskCanvas: null,
    rgbCanvas: null,
    imgCtx: null,
    maskCtx: null,
    rgbCtx: null,
    canvasBackground: null,
    maskColor: { r: 0, g: 0, b: 0 },
    maskBlendMode: 'black' as MaskBlendMode,
    maskOpacity: 0.8
  }

  function getImgCanvas(): MockCanvas {
    if (!mockStore.imgCanvas) throw new Error('imgCanvas not initialized')
    return mockStore.imgCanvas
  }

  function getMaskCanvas(): MockCanvas {
    if (!mockStore.maskCanvas) throw new Error('maskCanvas not initialized')
    return mockStore.maskCanvas
  }

  function getRgbCanvas(): MockCanvas {
    if (!mockStore.rgbCanvas) throw new Error('rgbCanvas not initialized')
    return mockStore.rgbCanvas
  }

  function getImgCtx(): MockContext {
    if (!mockStore.imgCtx) throw new Error('imgCtx not initialized')
    return mockStore.imgCtx
  }

  function getMaskCtx(): MockContext {
    if (!mockStore.maskCtx) throw new Error('maskCtx not initialized')
    return mockStore.maskCtx
  }

  function getRgbCtx(): MockContext {
    if (!mockStore.rgbCtx) throw new Error('rgbCtx not initialized')
    return mockStore.rgbCtx
  }

  function getCanvasBackground(): { style: Partial<MockCanvasStyle> } {
    if (!mockStore.canvasBackground)
      throw new Error('canvasBackground not initialized')
    return mockStore.canvasBackground
  }

  return {
    mockStore,
    getImgCanvas,
    getMaskCanvas,
    getRgbCanvas,
    getImgCtx,
    getMaskCtx,
    getRgbCtx,
    getCanvasBackground
  }
})

vi.mock('@/stores/maskEditorStore', () => ({
  useMaskEditorStore: vi.fn(() => mockStore)
}))

function createMockImage(width: number, height: number): HTMLImageElement {
  return {
    width,
    height
  } as HTMLImageElement
}

describe('useCanvasManager', () => {
  let mockImageData: ImageData

  beforeEach(() => {
    vi.clearAllMocks()

    mockImageData = {
      data: new Uint8ClampedArray(100 * 100 * 4),
      width: 100,
      height: 100
    } as ImageData

    mockStore.imgCtx = {
      drawImage: vi.fn()
    }

    mockStore.maskCtx = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => mockImageData),
      putImageData: vi.fn(),
      globalCompositeOperation: 'source-over',
      fillStyle: ''
    }

    mockStore.rgbCtx = {
      drawImage: vi.fn()
    }

    mockStore.imgCanvas = {
      width: 0,
      height: 0,
      style: {}
    }

    mockStore.maskCanvas = {
      width: 0,
      height: 0,
      style: {
        mixBlendMode: '',
        opacity: ''
      }
    }

    mockStore.rgbCanvas = {
      width: 0,
      height: 0,
      style: {}
    }

    mockStore.canvasBackground = {
      style: {
        backgroundColor: ''
      }
    }

    mockStore.maskColor = { r: 0, g: 0, b: 0 }
    mockStore.maskBlendMode = MaskBlendMode.Black
    mockStore.maskOpacity = 0.8
  })

  describe('invalidateCanvas', () => {
    it('should set canvas dimensions', async () => {
      const manager = useCanvasManager()

      const origImage = createMockImage(512, 512)
      const maskImage = createMockImage(512, 512)

      await manager.invalidateCanvas(origImage, maskImage, null)

      expect(getImgCanvas().width).toBe(512)
      expect(getImgCanvas().height).toBe(512)
      expect(getMaskCanvas().width).toBe(512)
      expect(getMaskCanvas().height).toBe(512)
      expect(getRgbCanvas().width).toBe(512)
      expect(getRgbCanvas().height).toBe(512)
    })

    it('should draw original image', async () => {
      const manager = useCanvasManager()

      const origImage = createMockImage(512, 512)
      const maskImage = createMockImage(512, 512)

      await manager.invalidateCanvas(origImage, maskImage, null)

      expect(getImgCtx().drawImage).toHaveBeenCalledWith(
        origImage,
        0,
        0,
        512,
        512
      )
    })

    it('should draw paint image when provided', async () => {
      const manager = useCanvasManager()

      const origImage = createMockImage(512, 512)
      const maskImage = createMockImage(512, 512)
      const paintImage = createMockImage(512, 512)

      await manager.invalidateCanvas(origImage, maskImage, paintImage)

      expect(getRgbCtx().drawImage).toHaveBeenCalledWith(
        paintImage,
        0,
        0,
        512,
        512
      )
    })

    it('should not draw paint image when null', async () => {
      const manager = useCanvasManager()

      const origImage = createMockImage(512, 512)
      const maskImage = createMockImage(512, 512)

      await manager.invalidateCanvas(origImage, maskImage, null)

      expect(getRgbCtx().drawImage).not.toHaveBeenCalled()
    })

    it('should prepare mask', async () => {
      const manager = useCanvasManager()

      const origImage = createMockImage(512, 512)
      const maskImage = createMockImage(512, 512)

      await manager.invalidateCanvas(origImage, maskImage, null)

      expect(getMaskCtx().drawImage).toHaveBeenCalled()
      expect(getMaskCtx().getImageData).toHaveBeenCalled()
      expect(getMaskCtx().putImageData).toHaveBeenCalled()
    })

    it('should throw error when canvas missing', async () => {
      const manager = useCanvasManager()

      mockStore.imgCanvas = null

      const origImage = createMockImage(512, 512)
      const maskImage = createMockImage(512, 512)

      await expect(
        manager.invalidateCanvas(origImage, maskImage, null)
      ).rejects.toThrow('Canvas elements or contexts not available')
    })

    it('should throw error when context missing', async () => {
      const manager = useCanvasManager()

      mockStore.imgCtx = null

      const origImage = createMockImage(512, 512)
      const maskImage = createMockImage(512, 512)

      await expect(
        manager.invalidateCanvas(origImage, maskImage, null)
      ).rejects.toThrow('Canvas elements or contexts not available')
    })
  })

  describe('updateMaskColor', () => {
    it('should update mask color for black blend mode', async () => {
      const manager = useCanvasManager()

      mockStore.maskBlendMode = MaskBlendMode.Black
      mockStore.maskColor = { r: 0, g: 0, b: 0 }

      await manager.updateMaskColor()

      expect(getMaskCtx().fillStyle).toBe('rgb(0, 0, 0)')
      expect(getMaskCanvas().style.mixBlendMode).toBe('initial')
      expect(getMaskCanvas().style.opacity).toBe('0.8')
      expect(getCanvasBackground().style.backgroundColor).toBe('rgba(0,0,0,1)')
    })

    it('should update mask color for white blend mode', async () => {
      const manager = useCanvasManager()

      mockStore.maskBlendMode = MaskBlendMode.White
      mockStore.maskColor = { r: 255, g: 255, b: 255 }

      await manager.updateMaskColor()

      expect(getMaskCtx().fillStyle).toBe('rgb(255, 255, 255)')
      expect(getMaskCanvas().style.mixBlendMode).toBe('initial')
      expect(getCanvasBackground().style.backgroundColor).toBe(
        'rgba(255,255,255,1)'
      )
    })

    it('should update mask color for negative blend mode', async () => {
      const manager = useCanvasManager()

      mockStore.maskBlendMode = MaskBlendMode.Negative
      mockStore.maskColor = { r: 255, g: 255, b: 255 }

      await manager.updateMaskColor()

      expect(getMaskCanvas().style.mixBlendMode).toBe('difference')
      expect(getMaskCanvas().style.opacity).toBe('1')
      expect(getCanvasBackground().style.backgroundColor).toBe(
        'rgba(255,255,255,1)'
      )
    })

    it('should update all pixels with mask color', async () => {
      const manager = useCanvasManager()

      mockStore.maskColor = { r: 128, g: 64, b: 32 }
      getMaskCanvas().width = 100
      getMaskCanvas().height = 100

      await manager.updateMaskColor()

      for (let i = 0; i < mockImageData.data.length; i += 4) {
        expect(mockImageData.data[i]).toBe(128)
        expect(mockImageData.data[i + 1]).toBe(64)
        expect(mockImageData.data[i + 2]).toBe(32)
      }

      expect(getMaskCtx().putImageData).toHaveBeenCalledWith(
        mockImageData,
        0,
        0
      )
    })

    it('should return early when canvas missing', async () => {
      const manager = useCanvasManager()
      const maskCtxBeforeNull = getMaskCtx()

      mockStore.maskCanvas = null

      await manager.updateMaskColor()

      expect(maskCtxBeforeNull.getImageData).not.toHaveBeenCalled()
    })

    it('should return early when context missing', async () => {
      const manager = useCanvasManager()
      const canvasBgBeforeNull = getCanvasBackground()

      mockStore.maskCtx = null

      await manager.updateMaskColor()

      expect(canvasBgBeforeNull.style.backgroundColor).toBe('')
    })

    it('should handle different opacity values', async () => {
      const manager = useCanvasManager()

      mockStore.maskOpacity = 0.5

      await manager.updateMaskColor()

      expect(getMaskCanvas().style.opacity).toBe('0.5')
    })
  })

  describe('prepareMask', () => {
    it('should invert mask alpha', async () => {
      const manager = useCanvasManager()

      for (let i = 0; i < mockImageData.data.length; i += 4) {
        mockImageData.data[i + 3] = 128
      }

      const origImage = createMockImage(100, 100)
      const maskImage = createMockImage(100, 100)

      await manager.invalidateCanvas(origImage, maskImage, null)

      for (let i = 0; i < mockImageData.data.length; i += 4) {
        expect(mockImageData.data[i + 3]).toBe(127)
      }
    })

    it('should apply mask color to all pixels', async () => {
      const manager = useCanvasManager()

      mockStore.maskColor = { r: 100, g: 150, b: 200 }

      const origImage = createMockImage(100, 100)
      const maskImage = createMockImage(100, 100)

      await manager.invalidateCanvas(origImage, maskImage, null)

      for (let i = 0; i < mockImageData.data.length; i += 4) {
        expect(mockImageData.data[i]).toBe(100)
        expect(mockImageData.data[i + 1]).toBe(150)
        expect(mockImageData.data[i + 2]).toBe(200)
      }
    })

    it('should set composite operation', async () => {
      const manager = useCanvasManager()

      const origImage = createMockImage(100, 100)
      const maskImage = createMockImage(100, 100)

      await manager.invalidateCanvas(origImage, maskImage, null)

      expect(getMaskCtx().globalCompositeOperation).toBe('source-over')
    })
  })
})
