import { useMaskEditorStore } from '@/stores/maskEditorStore'
import { useMaskEditorDataStore } from '@/stores/maskEditorDataStore'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toNodeId } from '@/types/nodeId'

import { useImageLoader } from '@/composables/maskeditor/useImageLoader'

const mockCanvasManager = {
  invalidateCanvas: vi.fn().mockResolvedValue(undefined),
  updateMaskColor: vi.fn().mockResolvedValue(undefined)
}

let mockStore: ReturnType<typeof useMaskEditorStore>

let mockDataStore: ReturnType<typeof useMaskEditorDataStore>

vi.mock(import('@/composables/maskeditor/useCanvasManager'), () => ({
  useCanvasManager: vi.fn(() => mockCanvasManager)
}))

vi.mock(import('@vueuse/core'), () => ({
  createSharedComposable: <T extends (...args: unknown[]) => unknown>(fn: T) =>
    fn
}))

describe('useImageLoader', () => {
  let mockBaseImage: HTMLImageElement
  let mockMaskImage: HTMLImageElement
  let mockPaintImage: HTMLImageElement

  beforeEach(() => {
    mockStore = useMaskEditorStore()
    mockDataStore = useMaskEditorDataStore()
    mockBaseImage = new Image(512, 512)
    mockMaskImage = new Image(512, 512)
    mockPaintImage = new Image(512, 512)

    mockStore.imgCtx = {
      clearRect: vi.fn()
    } as Partial<CanvasRenderingContext2D> as CanvasRenderingContext2D

    mockStore.maskCtx = {
      clearRect: vi.fn()
    } as Partial<CanvasRenderingContext2D> as CanvasRenderingContext2D

    mockStore.imgCanvas = {
      getContext: vi.fn().mockImplementation(() => mockStore.imgCtx),
      width: 0,
      height: 0
    } as Partial<HTMLCanvasElement> as HTMLCanvasElement

    mockStore.maskCanvas = {
      getContext: vi.fn().mockImplementation(() => mockStore.maskCtx),
      width: 0,
      height: 0
    } as Partial<HTMLCanvasElement> as HTMLCanvasElement

    mockStore.rgbCanvas = {
      getContext: vi.fn().mockImplementation(() => mockStore.rgbCtx),
      width: 0,
      height: 0
    } as Partial<HTMLCanvasElement> as HTMLCanvasElement

    mockDataStore.inputData = {
      baseLayer: { image: mockBaseImage, url: 'base.png' },
      maskLayer: { image: mockMaskImage, url: 'mask.png' },
      paintLayer: { image: mockPaintImage, url: 'paint.png' },
      sourceRef: { filename: 'base.png' },
      nodeId: toNodeId(1)
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

      expect(mockStore.maskCanvas?.width).toBe(512)
      expect(mockStore.maskCanvas?.height).toBe(512)
      expect(mockStore.rgbCanvas?.width).toBe(512)
      expect(mockStore.rgbCanvas?.height).toBe(512)
    })

    it('should clear canvas contexts', async () => {
      const loader = useImageLoader()

      await loader.loadImages()

      expect(mockStore.imgCtx?.clearRect).toHaveBeenCalledWith(0, 0, 0, 0)
      expect(mockStore.maskCtx?.clearRect).toHaveBeenCalledWith(0, 0, 0, 0)
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
        baseLayer: { image: mockBaseImage, url: 'base.png' },
        maskLayer: { image: mockMaskImage, url: 'mask.png' },
        sourceRef: { filename: 'base.png', subfolder: '', type: 'input' },
        nodeId: toNodeId(1)
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

      expect(mockStore.maskCanvas?.width).toBe(1024)
      expect(mockStore.maskCanvas?.height).toBe(768)
      expect(mockStore.rgbCanvas?.width).toBe(1024)
      expect(mockStore.rgbCanvas?.height).toBe(768)
    })
  })
})
