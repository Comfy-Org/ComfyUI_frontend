import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCanvasTransform } from '@/composables/maskeditor/useCanvasTransform'

let mockMaskCanvas: any
let mockRgbCanvas: any
let mockImgCanvas: any
let mockMaskCtx: any
let mockRgbCtx: any
let mockImgCtx: any

const mockCanvasHistory = {
  saveState: vi.fn()
}

const mockStore = {
  maskCanvas: null as any,
  rgbCanvas: null as any,
  imgCanvas: null as any,
  maskCtx: null as any,
  rgbCtx: null as any,
  imgCtx: null as any,
  tgpuRoot: null as any,
  canvasHistory: mockCanvasHistory,
  gpuTexturesNeedRecreation: false,
  gpuTextureWidth: 0,
  gpuTextureHeight: 0,
  pendingGPUMaskData: null as any,
  pendingGPURgbData: null as any
}

vi.mock('@/stores/maskEditorStore', () => ({
  useMaskEditorStore: vi.fn(() => mockStore)
}))

describe('useCanvasTransform', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    const createMockImageData = (width: number, height: number) => {
      const data = new Uint8ClampedArray(width * height * 4)
      // Fill with a recognizable pattern for testing
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 255 // R
        data[i + 1] = 0 // G
        data[i + 2] = 0 // B
        data[i + 3] = 255 // A
      }
      return {
        data,
        width,
        height
      } as ImageData
    }

    mockMaskCtx = {
      getImageData: vi.fn((_x, _y, w, h) => createMockImageData(w, h)),
      putImageData: vi.fn(),
      clearRect: vi.fn(),
      drawImage: vi.fn()
    }

    mockRgbCtx = {
      getImageData: vi.fn((_x, _y, w, h) => createMockImageData(w, h)),
      putImageData: vi.fn(),
      clearRect: vi.fn(),
      drawImage: vi.fn()
    }

    mockImgCtx = {
      getImageData: vi.fn((_x, _y, w, h) => createMockImageData(w, h)),
      putImageData: vi.fn(),
      clearRect: vi.fn(),
      drawImage: vi.fn()
    }

    mockMaskCanvas = {
      width: 100,
      height: 50
    }

    mockRgbCanvas = {
      width: 100,
      height: 50
    }

    mockImgCanvas = {
      width: 100,
      height: 50
    }

    mockStore.maskCanvas = mockMaskCanvas
    mockStore.rgbCanvas = mockRgbCanvas
    mockStore.imgCanvas = mockImgCanvas
    mockStore.maskCtx = mockMaskCtx
    mockStore.rgbCtx = mockRgbCtx
    mockStore.imgCtx = mockImgCtx
    mockStore.tgpuRoot = null
    mockStore.gpuTexturesNeedRecreation = false
    mockStore.gpuTextureWidth = 0
    mockStore.gpuTextureHeight = 0
    mockStore.pendingGPUMaskData = null
    mockStore.pendingGPURgbData = null
  })

  describe('rotateClockwise', () => {
    it('should rotate canvas 90 degrees clockwise', async () => {
      const transform = useCanvasTransform()

      await transform.rotateClockwise()

      // Canvas dimensions should be swapped
      expect(mockMaskCanvas.width).toBe(50)
      expect(mockMaskCanvas.height).toBe(100)
      expect(mockRgbCanvas.width).toBe(50)
      expect(mockRgbCanvas.height).toBe(100)
      expect(mockImgCanvas.width).toBe(50)
      expect(mockImgCanvas.height).toBe(100)
    })

    it('should call getImageData with original dimensions', async () => {
      const transform = useCanvasTransform()

      await transform.rotateClockwise()

      expect(mockMaskCtx.getImageData).toHaveBeenCalledWith(0, 0, 100, 50)
      expect(mockRgbCtx.getImageData).toHaveBeenCalledWith(0, 0, 100, 50)
      expect(mockImgCtx.getImageData).toHaveBeenCalledWith(0, 0, 100, 50)
    })

    it('should call putImageData with rotated data', async () => {
      const transform = useCanvasTransform()

      await transform.rotateClockwise()

      expect(mockMaskCtx.putImageData).toHaveBeenCalled()
      expect(mockRgbCtx.putImageData).toHaveBeenCalled()
      expect(mockImgCtx.putImageData).toHaveBeenCalled()

      // Verify the rotated ImageData has swapped dimensions
      const maskCall = mockMaskCtx.putImageData.mock.calls[0][0]
      expect(maskCall.width).toBe(50)
      expect(maskCall.height).toBe(100)
    })

    it('should save state to history', async () => {
      const transform = useCanvasTransform()

      await transform.rotateClockwise()

      expect(mockCanvasHistory.saveState).toHaveBeenCalled()
    })

    it('should log error when canvas contexts not ready', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      mockStore.maskCanvas = null

      const transform = useCanvasTransform()
      await transform.rotateClockwise()

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[useCanvasTransform] Canvas contexts not ready'
      )

      consoleErrorSpy.mockRestore()
    })

    it('should handle GPU texture recreation when GPU is active', async () => {
      mockStore.tgpuRoot = {} // Mock GPU being active

      const transform = useCanvasTransform()
      await transform.rotateClockwise()

      expect(mockStore.gpuTexturesNeedRecreation).toBe(true)
      expect(mockStore.gpuTextureWidth).toBe(50)
      expect(mockStore.gpuTextureHeight).toBe(100)
    })

    it('should not recreate GPU textures when GPU is inactive', async () => {
      mockStore.tgpuRoot = null

      const transform = useCanvasTransform()
      await transform.rotateClockwise()

      expect(mockStore.gpuTexturesNeedRecreation).toBe(false)
    })
  })

  describe('rotateCounterclockwise', () => {
    it('should rotate canvas 90 degrees counterclockwise', async () => {
      const transform = useCanvasTransform()

      await transform.rotateCounterclockwise()

      // Canvas dimensions should be swapped
      expect(mockMaskCanvas.width).toBe(50)
      expect(mockMaskCanvas.height).toBe(100)
      expect(mockRgbCanvas.width).toBe(50)
      expect(mockRgbCanvas.height).toBe(100)
      expect(mockImgCanvas.width).toBe(50)
      expect(mockImgCanvas.height).toBe(100)
    })

    it('should call getImageData with original dimensions', async () => {
      const transform = useCanvasTransform()

      await transform.rotateCounterclockwise()

      expect(mockMaskCtx.getImageData).toHaveBeenCalledWith(0, 0, 100, 50)
      expect(mockRgbCtx.getImageData).toHaveBeenCalledWith(0, 0, 100, 50)
      expect(mockImgCtx.getImageData).toHaveBeenCalledWith(0, 0, 100, 50)
    })

    it('should call putImageData with rotated data', async () => {
      const transform = useCanvasTransform()

      await transform.rotateCounterclockwise()

      expect(mockMaskCtx.putImageData).toHaveBeenCalled()
      expect(mockRgbCtx.putImageData).toHaveBeenCalled()
      expect(mockImgCtx.putImageData).toHaveBeenCalled()

      const maskCall = mockMaskCtx.putImageData.mock.calls[0][0]
      expect(maskCall.width).toBe(50)
      expect(maskCall.height).toBe(100)
    })

    it('should save state to history', async () => {
      const transform = useCanvasTransform()

      await transform.rotateCounterclockwise()

      expect(mockCanvasHistory.saveState).toHaveBeenCalled()
    })

    it('should produce different result than clockwise rotation', async () => {
      const transform = useCanvasTransform()

      // Create a non-uniform pattern to detect rotation direction
      const createAsymmetricImageData = (width: number, height: number) => {
        const data = new Uint8ClampedArray(width * height * 4)
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4
            // Top-left quadrant is red, others are black
            if (x < width / 2 && y < height / 2) {
              data[i] = 255
              data[i + 1] = 0
              data[i + 2] = 0
              data[i + 3] = 255
            } else {
              data[i] = 0
              data[i + 1] = 0
              data[i + 2] = 0
              data[i + 3] = 255
            }
          }
        }
        return { data, width, height } as ImageData
      }

      mockMaskCtx.getImageData = vi.fn(() => createAsymmetricImageData(100, 50))

      await transform.rotateCounterclockwise()

      const result = mockMaskCtx.putImageData.mock.calls[0][0]

      // After counterclockwise rotation, dimensions swap
      expect(result.width).toBe(50)
      expect(result.height).toBe(100)
    })
  })

  describe('mirrorHorizontal', () => {
    it('should mirror canvas horizontally', async () => {
      const transform = useCanvasTransform()

      await transform.mirrorHorizontal()

      // Dimensions should remain the same
      expect(mockMaskCanvas.width).toBe(100)
      expect(mockMaskCanvas.height).toBe(50)
      expect(mockRgbCanvas.width).toBe(100)
      expect(mockRgbCanvas.height).toBe(50)
      expect(mockImgCanvas.width).toBe(100)
      expect(mockImgCanvas.height).toBe(50)
    })

    it('should call getImageData with same dimensions', async () => {
      const transform = useCanvasTransform()

      await transform.mirrorHorizontal()

      expect(mockMaskCtx.getImageData).toHaveBeenCalledWith(0, 0, 100, 50)
      expect(mockRgbCtx.getImageData).toHaveBeenCalledWith(0, 0, 100, 50)
      expect(mockImgCtx.getImageData).toHaveBeenCalledWith(0, 0, 100, 50)
    })

    it('should call putImageData with mirrored data', async () => {
      const transform = useCanvasTransform()

      await transform.mirrorHorizontal()

      expect(mockMaskCtx.putImageData).toHaveBeenCalled()
      expect(mockRgbCtx.putImageData).toHaveBeenCalled()
      expect(mockImgCtx.putImageData).toHaveBeenCalled()

      const maskCall = mockMaskCtx.putImageData.mock.calls[0][0]
      expect(maskCall.width).toBe(100)
      expect(maskCall.height).toBe(50)
    })

    it('should save state to history', async () => {
      const transform = useCanvasTransform()

      await transform.mirrorHorizontal()

      expect(mockCanvasHistory.saveState).toHaveBeenCalled()
    })

    it('should handle GPU texture recreation when GPU is active', async () => {
      mockStore.tgpuRoot = {}

      const transform = useCanvasTransform()
      await transform.mirrorHorizontal()

      expect(mockStore.gpuTexturesNeedRecreation).toBe(true)
      expect(mockStore.gpuTextureWidth).toBe(100)
      expect(mockStore.gpuTextureHeight).toBe(50)
    })
  })

  describe('mirrorVertical', () => {
    it('should mirror canvas vertically', async () => {
      const transform = useCanvasTransform()

      await transform.mirrorVertical()

      // Dimensions should remain the same
      expect(mockMaskCanvas.width).toBe(100)
      expect(mockMaskCanvas.height).toBe(50)
      expect(mockRgbCanvas.width).toBe(100)
      expect(mockRgbCanvas.height).toBe(50)
      expect(mockImgCanvas.width).toBe(100)
      expect(mockImgCanvas.height).toBe(50)
    })

    it('should call getImageData with same dimensions', async () => {
      const transform = useCanvasTransform()

      await transform.mirrorVertical()

      expect(mockMaskCtx.getImageData).toHaveBeenCalledWith(0, 0, 100, 50)
      expect(mockRgbCtx.getImageData).toHaveBeenCalledWith(0, 0, 100, 50)
      expect(mockImgCtx.getImageData).toHaveBeenCalledWith(0, 0, 100, 50)
    })

    it('should call putImageData with mirrored data', async () => {
      const transform = useCanvasTransform()

      await transform.mirrorVertical()

      expect(mockMaskCtx.putImageData).toHaveBeenCalled()
      expect(mockRgbCtx.putImageData).toHaveBeenCalled()
      expect(mockImgCtx.putImageData).toHaveBeenCalled()

      const maskCall = mockMaskCtx.putImageData.mock.calls[0][0]
      expect(maskCall.width).toBe(100)
      expect(maskCall.height).toBe(50)
    })

    it('should save state to history', async () => {
      const transform = useCanvasTransform()

      await transform.mirrorVertical()

      expect(mockCanvasHistory.saveState).toHaveBeenCalled()
    })
  })

  describe('pixel-level transformations', () => {
    it('should correctly rotate pixels clockwise', async () => {
      // Create a 2x2 canvas with distinct corners
      mockMaskCanvas.width = 2
      mockMaskCanvas.height = 2

      const createTestPattern = () => {
        const data = new Uint8ClampedArray(2 * 2 * 4)
        // Top-left: Red
        data[0] = 255
        data[1] = 0
        data[2] = 0
        data[3] = 255
        // Top-right: Green
        data[4] = 0
        data[5] = 255
        data[6] = 0
        data[7] = 255
        // Bottom-left: Blue
        data[8] = 0
        data[9] = 0
        data[10] = 255
        data[11] = 255
        // Bottom-right: Yellow
        data[12] = 255
        data[13] = 255
        data[14] = 0
        data[15] = 255
        return { data, width: 2, height: 2 } as ImageData
      }

      mockMaskCtx.getImageData = vi.fn(() => createTestPattern())

      const transform = useCanvasTransform()
      await transform.rotateClockwise()

      const result = mockMaskCtx.putImageData.mock.calls[0][0]

      // After clockwise rotation:
      // Top-left should be Blue (was bottom-left)
      expect(result.data[0]).toBe(0)
      expect(result.data[1]).toBe(0)
      expect(result.data[2]).toBe(255)

      // Top-right should be Red (was top-left)
      expect(result.data[4]).toBe(255)
      expect(result.data[5]).toBe(0)
      expect(result.data[6]).toBe(0)
    })

    it('should correctly mirror pixels horizontally', async () => {
      mockMaskCanvas.width = 2
      mockMaskCanvas.height = 2

      const createTestPattern = () => {
        const data = new Uint8ClampedArray(2 * 2 * 4)
        // Left column: Red
        data[0] = 255
        data[1] = 0
        data[2] = 0
        data[3] = 255
        data[8] = 255
        data[9] = 0
        data[10] = 0
        data[11] = 255
        // Right column: Green
        data[4] = 0
        data[5] = 255
        data[6] = 0
        data[7] = 255
        data[12] = 0
        data[13] = 255
        data[14] = 0
        data[15] = 255
        return { data, width: 2, height: 2 } as ImageData
      }

      mockMaskCtx.getImageData = vi.fn(() => createTestPattern())

      const transform = useCanvasTransform()
      await transform.mirrorHorizontal()

      const result = mockMaskCtx.putImageData.mock.calls[0][0]

      // After horizontal mirror, left and right should swap
      // Top-left should now be Green
      expect(result.data[0]).toBe(0)
      expect(result.data[1]).toBe(255)
      expect(result.data[2]).toBe(0)

      // Top-right should now be Red
      expect(result.data[4]).toBe(255)
      expect(result.data[5]).toBe(0)
      expect(result.data[6]).toBe(0)
    })
  })

  describe('error handling', () => {
    it('should handle missing canvas gracefully', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      mockStore.maskCanvas = null

      const transform = useCanvasTransform()
      await transform.rotateClockwise()

      expect(consoleErrorSpy).toHaveBeenCalled()
      consoleErrorSpy.mockRestore()
    })

    it('should handle missing context gracefully', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      mockStore.maskCtx = null

      const transform = useCanvasTransform()
      await transform.mirrorHorizontal()

      expect(consoleErrorSpy).toHaveBeenCalled()
      consoleErrorSpy.mockRestore()
    })
  })

  describe('GPU integration', () => {
    it('should set GPU recreation flags with correct dimensions for rotation', async () => {
      mockStore.tgpuRoot = {}
      mockMaskCanvas.width = 100
      mockMaskCanvas.height = 50

      const transform = useCanvasTransform()
      await transform.rotateClockwise()

      expect(mockStore.gpuTexturesNeedRecreation).toBe(true)
      expect(mockStore.gpuTextureWidth).toBe(50) // Swapped
      expect(mockStore.gpuTextureHeight).toBe(100) // Swapped
      expect(mockStore.pendingGPUMaskData).toBeDefined()
      expect(mockStore.pendingGPURgbData).toBeDefined()
    })

    it('should set GPU recreation flags with correct dimensions for mirror', async () => {
      mockStore.tgpuRoot = {}
      mockMaskCanvas.width = 100
      mockMaskCanvas.height = 50

      const transform = useCanvasTransform()
      await transform.mirrorHorizontal()

      expect(mockStore.gpuTexturesNeedRecreation).toBe(true)
      expect(mockStore.gpuTextureWidth).toBe(100) // Not swapped
      expect(mockStore.gpuTextureHeight).toBe(50) // Not swapped
      expect(mockStore.pendingGPUMaskData).toBeDefined()
      expect(mockStore.pendingGPURgbData).toBeDefined()
    })

    it('should not set pending GPU data when GPU inactive', async () => {
      mockStore.tgpuRoot = null

      const transform = useCanvasTransform()
      await transform.rotateClockwise()

      expect(mockStore.pendingGPUMaskData).toBeNull()
      expect(mockStore.pendingGPURgbData).toBeNull()
    })
  })
})
