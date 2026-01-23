import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useImageLoader } from '@/composables/maskeditor/useImageLoader'

const mockCanvasManager = {
  invalidateCanvas: vi.fn().mockResolvedValue(undefined),
  updateMaskColor: vi.fn().mockResolvedValue(undefined)
}

const mockStore: {
  imgCanvas: unknown
  maskCanvas: unknown
  rgbCanvas: unknown
  imgCtx: unknown
  maskCtx: unknown
  image: unknown
} = {
  imgCanvas: null,
  maskCanvas: null,
  rgbCanvas: null,
  imgCtx: null,
  maskCtx: null,
  image: null
}

const mockDataStore: {
  inputData: unknown
} = {
  inputData: null
}

vi.mock('@/stores/maskEditorStore', () => ({
  useMaskEditorStore: vi.fn(() => mockStore)
}))

vi.mock('@/stores/maskEditorDataStore', () => ({
  useMaskEditorDataStore: vi.fn(() => mockDataStore)
}))

vi.mock('@/composables/maskeditor/useCanvasManager', () => ({
  useCanvasManager: vi.fn(() => mockCanvasManager)
}))

vi.mock('@vueuse/core', () => ({
  createSharedComposable: <T extends (...args: unknown[]) => unknown>(fn: T) =>
    fn
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

      expect((mockStore.maskCanvas as { width: number }).width).toBe(512)
      expect((mockStore.maskCanvas as { height: number }).height).toBe(512)
      expect((mockStore.rgbCanvas as { width: number }).width).toBe(512)
      expect((mockStore.rgbCanvas as { height: number }).height).toBe(512)
    })

    it('should clear canvas contexts', async () => {
      const loader = useImageLoader()

      await loader.loadImages()

      expect(
        (mockStore.imgCtx as { clearRect: ReturnType<typeof vi.fn> }).clearRect
      ).toHaveBeenCalledWith(0, 0, 0, 0)
      expect(
        (mockStore.maskCtx as { clearRect: ReturnType<typeof vi.fn> }).clearRect
      ).toHaveBeenCalledWith(0, 0, 0, 0)
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

      expect((mockStore.maskCanvas as { width: number }).width).toBe(1024)
      expect((mockStore.maskCanvas as { height: number }).height).toBe(768)
      expect((mockStore.rgbCanvas as { width: number }).width).toBe(1024)
      expect((mockStore.rgbCanvas as { height: number }).height).toBe(768)
    })
  })
})
