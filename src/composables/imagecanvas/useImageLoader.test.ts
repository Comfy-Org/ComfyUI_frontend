import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useImageLoader } from '@/composables/imagecanvas/useImageLoader'

const mockCanvasManager = {
  invalidateCanvas: vi.fn().mockResolvedValue(undefined),
  updateMaskColor: vi.fn().mockResolvedValue(undefined)
}

const mockStore = {
  imgCanvas: null as any,
  maskCanvas: null as any,
  rgbCanvas: null as any,
  imgCtx: null as any,
  maskCtx: null as any,
  image: null as any
}

const mockDataStore = {
  inputData: null as any
}

vi.mock('@/stores/imageCanvasStore', () => ({
  useImageCanvasStore: vi.fn(() => mockStore)
}))

vi.mock('@/stores/imageCanvasDataStore', () => ({
  useImageCanvasDataStore: vi.fn(() => mockDataStore)
}))

vi.mock('@/composables/imagecanvas/useCanvasManager', () => ({
  useCanvasManager: vi.fn(() => mockCanvasManager)
}))

vi.mock('@vueuse/core', () => ({
  createSharedComposable: (fn: any) => fn
}))

describe('useImageLoader', () => {
  let mockBaseImage: HTMLImageElement
  let mockMaskImage: HTMLImageElement
  let mockPaintImage: HTMLImageElement

  beforeEach(() => {
    vi.clearAllMocks()

    mockBaseImage = {
      width: 512,
      height: 512
    } as HTMLImageElement

    mockMaskImage = {
      width: 512,
      height: 512
    } as HTMLImageElement

    mockPaintImage = {
      width: 512,
      height: 512
    } as HTMLImageElement

    mockStore.imgCtx = {
      clearRect: vi.fn()
    }

    mockStore.maskCtx = {
      clearRect: vi.fn()
    }

    mockStore.imgCanvas = {
      width: 0,
      height: 0
    }

    mockStore.maskCanvas = {
      width: 0,
      height: 0
    }

    mockStore.rgbCanvas = {
      width: 0,
      height: 0
    }

    mockDataStore.inputData = {
      baseLayer: { image: mockBaseImage },
      maskLayer: { image: mockMaskImage },
      paintLayer: { image: mockPaintImage }
    }
  })

  describe('loadImages', () => {
    it('should load images successfully', async () => {
      const loader = useImageLoader()

      const result = await loader.loadImages()

      expect(result).toBe(mockBaseImage)
      expect(mockStore.image).toBe(mockBaseImage)
    })

    it('should set canvas dimensions', async () => {
      const loader = useImageLoader()

      await loader.loadImages()

      expect(mockStore.maskCanvas.width).toBe(512)
      expect(mockStore.maskCanvas.height).toBe(512)
      expect(mockStore.rgbCanvas.width).toBe(512)
      expect(mockStore.rgbCanvas.height).toBe(512)
    })

    it('should clear canvas contexts', async () => {
      const loader = useImageLoader()

      await loader.loadImages()

      expect(mockStore.imgCtx.clearRect).toHaveBeenCalledWith(0, 0, 0, 0)
      expect(mockStore.maskCtx.clearRect).toHaveBeenCalledWith(0, 0, 0, 0)
    })

    it('should call canvasManager methods', async () => {
      const loader = useImageLoader()

      await loader.loadImages()

      expect(mockCanvasManager.invalidateCanvas).toHaveBeenCalledWith(
        mockBaseImage,
        mockMaskImage,
        mockPaintImage
      )
      expect(mockCanvasManager.updateMaskColor).toHaveBeenCalled()
    })

    it('should handle missing paintLayer', async () => {
      mockDataStore.inputData = {
        baseLayer: { image: mockBaseImage },
        maskLayer: { image: mockMaskImage },
        paintLayer: null
      }

      const loader = useImageLoader()

      await loader.loadImages()

      expect(mockCanvasManager.invalidateCanvas).toHaveBeenCalledWith(
        mockBaseImage,
        mockMaskImage,
        null
      )
    })

    it('should throw error when no input data', async () => {
      mockDataStore.inputData = null

      const loader = useImageLoader()

      await expect(loader.loadImages()).rejects.toThrow(
        'No input data available in dataStore'
      )
    })

    it('should throw error when canvas elements missing', async () => {
      mockStore.imgCanvas = null

      const loader = useImageLoader()

      await expect(loader.loadImages()).rejects.toThrow(
        'Canvas elements or contexts not available'
      )
    })

    it('should throw error when contexts missing', async () => {
      mockStore.imgCtx = null

      const loader = useImageLoader()

      await expect(loader.loadImages()).rejects.toThrow(
        'Canvas elements or contexts not available'
      )
    })

    it('should handle different image dimensions', async () => {
      mockBaseImage.width = 1024
      mockBaseImage.height = 768

      const loader = useImageLoader()

      await loader.loadImages()

      expect(mockStore.maskCanvas.width).toBe(1024)
      expect(mockStore.maskCanvas.height).toBe(768)
      expect(mockStore.rgbCanvas.width).toBe(1024)
      expect(mockStore.rgbCanvas.height).toBe(768)
    })
  })
})
