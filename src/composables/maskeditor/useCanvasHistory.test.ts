import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useCanvasHistory } from '@/composables/maskeditor/useCanvasHistory'

let mockMaskCanvas: any
let mockRgbCanvas: any
let mockImgCanvas: any
let mockMaskCtx: any
let mockRgbCtx: any
let mockImgCtx: any

const mockStore = {
  maskCanvas: null as any,
  rgbCanvas: null as any,
  imgCanvas: null as any,
  maskCtx: null as any,
  rgbCtx: null as any,
  imgCtx: null as any
}

vi.mock('@/stores/maskEditorStore', () => ({
  useMaskEditorStore: vi.fn(() => mockStore)
}))

// Mock ImageBitmap for test environment
if (typeof globalThis.ImageBitmap === 'undefined') {
  globalThis.ImageBitmap = class ImageBitmap {
    width: number
    height: number
    constructor(width = 100, height = 100) {
      this.width = width
      this.height = height
    }
    close() {}
  } as any
}

describe('useCanvasHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    let rafCallCount = 0
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
      (cb: FrameRequestCallback) => {
        if (rafCallCount++ < 100) {
          setTimeout(() => cb(0), 0)
        }
        return rafCallCount
      }
    )

    const createMockImageData = () => {
      return {
        data: new Uint8ClampedArray(100 * 100 * 4),
        width: 100,
        height: 100
      } as ImageData
    }

    mockMaskCtx = {
      getImageData: vi.fn(() => createMockImageData()),
      putImageData: vi.fn(),
      clearRect: vi.fn(),
      drawImage: vi.fn()
    }

    mockRgbCtx = {
      getImageData: vi.fn(() => createMockImageData()),
      putImageData: vi.fn(),
      clearRect: vi.fn(),
      drawImage: vi.fn()
    }

    mockImgCtx = {
      getImageData: vi.fn(() => createMockImageData()),
      putImageData: vi.fn(),
      clearRect: vi.fn(),
      drawImage: vi.fn()
    }

    mockMaskCanvas = {
      width: 100,
      height: 100
    }

    mockRgbCanvas = {
      width: 100,
      height: 100
    }

    mockImgCanvas = {
      width: 100,
      height: 100
    }

    mockStore.maskCanvas = mockMaskCanvas
    mockStore.rgbCanvas = mockRgbCanvas
    mockStore.imgCanvas = mockImgCanvas
    mockStore.maskCtx = mockMaskCtx
    mockStore.rgbCtx = mockRgbCtx
    mockStore.imgCtx = mockImgCtx
  })

  describe('initialization', () => {
    it('should initialize with default values', () => {
      const history = useCanvasHistory()

      expect(history.canUndo.value).toBe(false)
      expect(history.canRedo.value).toBe(false)
    })

    it('should save initial state', () => {
      const history = useCanvasHistory()

      history.saveInitialState()

      expect(mockMaskCtx.getImageData).toHaveBeenCalledWith(0, 0, 100, 100)
      expect(mockRgbCtx.getImageData).toHaveBeenCalledWith(0, 0, 100, 100)
      expect(mockImgCtx.getImageData).toHaveBeenCalledWith(0, 0, 100, 100)
      expect(history.canUndo.value).toBe(false)
      expect(history.canRedo.value).toBe(false)
    })

    it('should wait for canvas to be ready', () => {
      const rafSpy = vi.spyOn(window, 'requestAnimationFrame')

      mockStore.maskCanvas = { ...mockMaskCanvas, width: 0, height: 0 }

      const history = useCanvasHistory()
      history.saveInitialState()

      expect(rafSpy).toHaveBeenCalled()

      mockStore.maskCanvas = mockMaskCanvas
    })

    it('should wait for context to be ready', () => {
      const rafSpy = vi.spyOn(window, 'requestAnimationFrame')

      mockStore.maskCtx = null

      const history = useCanvasHistory()
      history.saveInitialState()

      expect(rafSpy).toHaveBeenCalled()

      mockStore.maskCtx = mockMaskCtx
    })
  })

  describe('saveState', () => {
    it('should save a new state', () => {
      const history = useCanvasHistory()

      history.saveInitialState()
      mockMaskCtx.getImageData.mockClear()
      mockRgbCtx.getImageData.mockClear()
      mockImgCtx.getImageData.mockClear()

      history.saveState()

      expect(mockMaskCtx.getImageData).toHaveBeenCalledWith(0, 0, 100, 100)
      expect(mockRgbCtx.getImageData).toHaveBeenCalledWith(0, 0, 100, 100)
      expect(mockImgCtx.getImageData).toHaveBeenCalledWith(0, 0, 100, 100)
      expect(history.canUndo.value).toBe(true)
    })

    it('should clear redo states when saving new state', () => {
      const history = useCanvasHistory()

      history.saveInitialState()
      history.saveState()
      history.saveState()
      history.undo()

      expect(history.canRedo.value).toBe(true)

      history.saveState()

      expect(history.canRedo.value).toBe(false)
    })

    it('should respect maxStates limit', () => {
      const history = useCanvasHistory(3)

      history.saveInitialState()
      history.saveState()
      history.saveState()
      history.saveState()
      history.saveState()

      expect(history.canUndo.value).toBe(true)

      let undoCount = 0
      while (history.canUndo.value && undoCount < 10) {
        history.undo()
        undoCount++
      }

      expect(undoCount).toBe(2)
    })

    it('should call saveInitialState if not initialized', () => {
      const history = useCanvasHistory()

      history.saveState()

      expect(mockMaskCtx.getImageData).toHaveBeenCalled()
      expect(mockRgbCtx.getImageData).toHaveBeenCalled()
      expect(mockImgCtx.getImageData).toHaveBeenCalled()
    })

    it('should not save state if context is missing', () => {
      const history = useCanvasHistory()

      history.saveInitialState()

      mockStore.maskCtx = null
      mockMaskCtx.getImageData.mockClear()
      mockRgbCtx.getImageData.mockClear()
      mockImgCtx.getImageData.mockClear()

      history.saveState()

      expect(mockMaskCtx.getImageData).not.toHaveBeenCalled()

      mockStore.maskCtx = mockMaskCtx
    })
  })

  describe('undo', () => {
    it('should undo to previous state', () => {
      const history = useCanvasHistory()

      history.saveInitialState()
      history.saveState()

      history.undo()

      expect(mockMaskCtx.putImageData).toHaveBeenCalled()
      expect(mockRgbCtx.putImageData).toHaveBeenCalled()
      expect(mockImgCtx.putImageData).toHaveBeenCalled()
      expect(history.canUndo.value).toBe(false)
      expect(history.canRedo.value).toBe(true)
    })

    it('should not undo when no undo states available', () => {
      const history = useCanvasHistory()

      history.saveInitialState()

      mockMaskCtx.putImageData.mockClear()
      mockRgbCtx.putImageData.mockClear()
      mockImgCtx.putImageData.mockClear()

      history.undo()

      expect(mockMaskCtx.putImageData).not.toHaveBeenCalled()
      expect(mockRgbCtx.putImageData).not.toHaveBeenCalled()
      expect(mockImgCtx.putImageData).not.toHaveBeenCalled()
    })

    it('should undo multiple times', () => {
      const history = useCanvasHistory()

      history.saveInitialState()
      history.saveState()
      history.saveState()
      history.saveState()

      history.undo()
      expect(history.canUndo.value).toBe(true)

      history.undo()
      expect(history.canUndo.value).toBe(true)

      history.undo()
      expect(history.canUndo.value).toBe(false)
    })

    it('should not undo beyond first state', () => {
      const history = useCanvasHistory()

      history.saveInitialState()
      history.saveState()

      history.undo()

      mockMaskCtx.putImageData.mockClear()
      mockRgbCtx.putImageData.mockClear()
      mockImgCtx.putImageData.mockClear()

      history.undo()

      expect(mockMaskCtx.putImageData).not.toHaveBeenCalled()
      expect(mockRgbCtx.putImageData).not.toHaveBeenCalled()
      expect(mockImgCtx.putImageData).not.toHaveBeenCalled()
    })
  })

  describe('redo', () => {
    it('should redo to next state', () => {
      const history = useCanvasHistory()

      history.saveInitialState()
      history.saveState()
      history.undo()

      mockMaskCtx.putImageData.mockClear()
      mockRgbCtx.putImageData.mockClear()
      mockImgCtx.putImageData.mockClear()

      history.redo()

      expect(mockMaskCtx.putImageData).toHaveBeenCalled()
      expect(mockRgbCtx.putImageData).toHaveBeenCalled()
      expect(mockImgCtx.putImageData).toHaveBeenCalled()
      expect(history.canRedo.value).toBe(false)
      expect(history.canUndo.value).toBe(true)
    })

    it('should not redo when no redo states available', () => {
      const history = useCanvasHistory()

      history.saveInitialState()

      mockMaskCtx.putImageData.mockClear()
      mockRgbCtx.putImageData.mockClear()
      mockImgCtx.putImageData.mockClear()

      history.redo()

      expect(mockMaskCtx.putImageData).not.toHaveBeenCalled()
      expect(mockRgbCtx.putImageData).not.toHaveBeenCalled()
      expect(mockImgCtx.putImageData).not.toHaveBeenCalled()
    })

    it('should redo multiple times', () => {
      const history = useCanvasHistory()

      history.saveInitialState()
      history.saveState()
      history.saveState()
      history.saveState()

      history.undo()
      history.undo()
      history.undo()

      history.redo()
      expect(history.canRedo.value).toBe(true)

      history.redo()
      expect(history.canRedo.value).toBe(true)

      history.redo()
      expect(history.canRedo.value).toBe(false)
    })

    it('should not redo beyond last state', () => {
      const history = useCanvasHistory()

      history.saveInitialState()
      history.saveState()
      history.undo()

      history.redo()

      mockMaskCtx.putImageData.mockClear()
      mockRgbCtx.putImageData.mockClear()
      mockImgCtx.putImageData.mockClear()

      history.redo()

      expect(mockMaskCtx.putImageData).not.toHaveBeenCalled()
      expect(mockRgbCtx.putImageData).not.toHaveBeenCalled()
      expect(mockImgCtx.putImageData).not.toHaveBeenCalled()
    })
  })

  describe('clearStates', () => {
    it('should clear all states', () => {
      const history = useCanvasHistory()

      history.saveInitialState()
      history.saveState()
      history.saveState()

      history.clearStates()

      expect(history.canUndo.value).toBe(false)
      expect(history.canRedo.value).toBe(false)
    })

    it('should allow saving initial state after clear', () => {
      const history = useCanvasHistory()

      history.saveInitialState()
      history.clearStates()

      mockMaskCtx.getImageData.mockClear()
      mockRgbCtx.getImageData.mockClear()
      mockImgCtx.getImageData.mockClear()

      history.saveInitialState()

      expect(mockMaskCtx.getImageData).toHaveBeenCalled()
      expect(mockRgbCtx.getImageData).toHaveBeenCalled()
      expect(mockImgCtx.getImageData).toHaveBeenCalled()
    })
  })

  describe('canUndo computed', () => {
    it('should be false with no states', () => {
      const history = useCanvasHistory()

      expect(history.canUndo.value).toBe(false)
    })

    it('should be false with only initial state', () => {
      const history = useCanvasHistory()

      history.saveInitialState()

      expect(history.canUndo.value).toBe(false)
    })

    it('should be true after saving a state', () => {
      const history = useCanvasHistory()

      history.saveInitialState()
      history.saveState()

      expect(history.canUndo.value).toBe(true)
    })

    it('should be false after undoing to first state', () => {
      const history = useCanvasHistory()

      history.saveInitialState()
      history.saveState()
      history.undo()

      expect(history.canUndo.value).toBe(false)
    })
  })

  describe('canRedo computed', () => {
    it('should be false with no undo', () => {
      const history = useCanvasHistory()

      history.saveInitialState()
      history.saveState()

      expect(history.canRedo.value).toBe(false)
    })

    it('should be true after undo', () => {
      const history = useCanvasHistory()

      history.saveInitialState()
      history.saveState()
      history.undo()

      expect(history.canRedo.value).toBe(true)
    })

    it('should be false after redo to last state', () => {
      const history = useCanvasHistory()

      history.saveInitialState()
      history.saveState()
      history.undo()
      history.redo()

      expect(history.canRedo.value).toBe(false)
    })

    it('should be false after saving new state', () => {
      const history = useCanvasHistory()

      history.saveInitialState()
      history.saveState()
      history.undo()

      expect(history.canRedo.value).toBe(true)

      history.saveState()

      expect(history.canRedo.value).toBe(false)
    })
  })

  describe('restoreState', () => {
    it('should not restore if context is missing', () => {
      const history = useCanvasHistory()

      history.saveInitialState()
      history.saveState()

      mockStore.maskCtx = null
      mockMaskCtx.putImageData.mockClear()
      mockRgbCtx.putImageData.mockClear()
      mockImgCtx.putImageData.mockClear()

      history.undo()

      expect(mockMaskCtx.putImageData).not.toHaveBeenCalled()

      mockStore.maskCtx = mockMaskCtx
    })
  })

  describe('edge cases', () => {
    it('should handle rapid state saves', async () => {
      const history = useCanvasHistory()

      history.saveInitialState()

      for (let i = 0; i < 10; i++) {
        history.saveState()
        await nextTick()
      }

      expect(history.canUndo.value).toBe(true)
    })

    it('should handle maxStates of 1', () => {
      const history = useCanvasHistory(1)

      history.saveInitialState()
      history.saveState()

      expect(history.canUndo.value).toBe(false)
    })

    it('should handle undo/redo cycling', () => {
      const history = useCanvasHistory()

      history.saveInitialState()
      history.saveState()
      history.saveState()

      history.undo()
      history.redo()
      history.undo()
      history.redo()
      history.undo()

      expect(history.canRedo.value).toBe(true)
      expect(history.canUndo.value).toBe(true)
    })

    it('should handle zero-sized canvas', () => {
      mockMaskCanvas.width = 0
      mockMaskCanvas.height = 0

      const history = useCanvasHistory()

      history.saveInitialState()

      expect(window.requestAnimationFrame).toHaveBeenCalled()
    })
  })
})
