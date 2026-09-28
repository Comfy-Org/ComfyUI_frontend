import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/canvasTestUtils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive, ref } from 'vue'
import { useCanvasHistory } from '@/composables/maskeditor/useCanvasHistory'
import type { CanvasHistoryLayers } from '@/composables/maskeditor/useCanvasHistory'

let layers: CanvasHistoryLayers

// Mock ImageBitmap using safe global augmentation pattern
if (typeof globalThis.ImageBitmap === 'undefined') {
  globalThis.ImageBitmap = class ImageBitmap {
    width: number
    height: number
    constructor(width = 100, height = 100) {
      this.width = width
      this.height = height
    }
    close() {}
  }
}

function createImageData(): ImageData {
  if (typeof ImageData !== 'undefined') {
    return new ImageData(100, 100)
  }

  return {
    colorSpace: 'srgb',
    data: new Uint8ClampedArray(100 * 100 * 4),
    width: 100,
    height: 100
  }
}

function createContext(): CanvasRenderingContext2D {
  return createMockCanvasRenderingContext2D({
    getImageData: vi.fn(createImageData),
    putImageData: vi.fn(),
    drawImage: vi.fn()
  })
}

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 100
  canvas.height = 100
  return canvas
}

describe('useCanvasHistory', () => {
  beforeEach(async () => {
    layers = reactive({
      maskCanvas: ref<HTMLCanvasElement | null>(null),
      maskCtx: ref<CanvasRenderingContext2D | null>(null),
      rgbCanvas: ref<HTMLCanvasElement | null>(null),
      rgbCtx: ref<CanvasRenderingContext2D | null>(null),
      imgCanvas: ref<HTMLCanvasElement | null>(null),
      imgCtx: ref<CanvasRenderingContext2D | null>(null)
    })
    let rafCallCount = 0
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
      (cb: FrameRequestCallback) => {
        if (rafCallCount++ < 100) {
          setTimeout(() => cb(0), 0)
        }
        return rafCallCount
      }
    )

    layers.maskCanvas = createCanvas()
    layers.rgbCanvas = createCanvas()
    layers.imgCanvas = createCanvas()

    await nextTick()

    layers.maskCtx = createContext()
    layers.rgbCtx = createContext()
    layers.imgCtx = createContext()
  })

  describe('initialization', () => {
    it('should initialize with default values', () => {
      const history = useCanvasHistory(layers)

      expect(history.canUndo.value).toBe(false)
      expect(history.canRedo.value).toBe(false)
    })

    it('should save initial state', () => {
      const history = useCanvasHistory(layers)

      history.saveInitialState()

      expect(layers.maskCtx!.getImageData).toHaveBeenCalledWith(0, 0, 100, 100)
      expect(layers.rgbCtx!.getImageData).toHaveBeenCalledWith(0, 0, 100, 100)
      expect(layers.imgCtx!.getImageData).toHaveBeenCalledWith(0, 0, 100, 100)
      expect(history.canUndo.value).toBe(false)
      expect(history.canRedo.value).toBe(false)
    })

    it('should wait for canvas to be ready', () => {
      const rafSpy = vi.spyOn(window, 'requestAnimationFrame')

      layers.maskCanvas!.width = 0
      layers.maskCanvas!.height = 0

      const history = useCanvasHistory(layers)
      history.saveInitialState()

      expect(rafSpy).toHaveBeenCalled()

      layers.maskCanvas!.width = 100
      layers.maskCanvas!.height = 100
    })

    it('should wait for context to be ready', () => {
      const rafSpy = vi.spyOn(window, 'requestAnimationFrame')

      layers.maskCtx = null

      const history = useCanvasHistory(layers)
      history.saveInitialState()

      expect(rafSpy).toHaveBeenCalled()

      layers.maskCtx = createContext()
    })
  })

  describe('saveState', () => {
    it('should save a new state', () => {
      const history = useCanvasHistory(layers)

      history.saveInitialState()
      vi.mocked(layers.maskCtx!.getImageData).mockClear()
      vi.mocked(layers.rgbCtx!.getImageData).mockClear()
      vi.mocked(layers.imgCtx!.getImageData).mockClear()

      history.saveState()

      expect(layers.maskCtx!.getImageData).toHaveBeenCalledWith(0, 0, 100, 100)
      expect(layers.rgbCtx!.getImageData).toHaveBeenCalledWith(0, 0, 100, 100)
      expect(layers.imgCtx!.getImageData).toHaveBeenCalledWith(0, 0, 100, 100)
      expect(history.canUndo.value).toBe(true)
    })

    it('should clear redo states when saving new state', () => {
      const history = useCanvasHistory(layers)

      history.saveInitialState()
      history.saveState()
      history.saveState()
      history.undo()

      expect(history.canRedo.value).toBe(true)

      history.saveState()

      expect(history.canRedo.value).toBe(false)
    })

    it('should respect maxStates limit', () => {
      const history = useCanvasHistory(layers, 3)

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
      const history = useCanvasHistory(layers)

      history.saveState()

      expect(layers.maskCtx!.getImageData).toHaveBeenCalled()
      expect(layers.rgbCtx!.getImageData).toHaveBeenCalled()
      expect(layers.imgCtx!.getImageData).toHaveBeenCalled()
    })

    it('should not save state if context is missing', () => {
      const history = useCanvasHistory(layers)

      history.saveInitialState()

      const savedMaskCtx = layers.maskCtx
      layers.maskCtx = null
      vi.mocked(savedMaskCtx!.getImageData).mockClear()
      vi.mocked(layers.rgbCtx!.getImageData).mockClear()
      vi.mocked(layers.imgCtx!.getImageData).mockClear()

      history.saveState()

      expect(savedMaskCtx!.getImageData).not.toHaveBeenCalled()

      layers.maskCtx = savedMaskCtx
    })
  })

  describe('undo', () => {
    it('should undo to previous state', () => {
      const history = useCanvasHistory(layers)

      history.saveInitialState()
      history.saveState()

      history.undo()

      expect(layers.maskCtx!.putImageData).toHaveBeenCalled()
      expect(layers.rgbCtx!.putImageData).toHaveBeenCalled()
      expect(layers.imgCtx!.putImageData).toHaveBeenCalled()
      expect(history.canUndo.value).toBe(false)
      expect(history.canRedo.value).toBe(true)
    })

    it('should not undo when no undo states available', () => {
      const history = useCanvasHistory(layers)

      history.saveInitialState()

      vi.mocked(layers.maskCtx!.putImageData).mockClear()
      vi.mocked(layers.rgbCtx!.putImageData).mockClear()
      vi.mocked(layers.imgCtx!.putImageData).mockClear()

      history.undo()

      expect(layers.maskCtx!.putImageData).not.toHaveBeenCalled()
      expect(layers.rgbCtx!.putImageData).not.toHaveBeenCalled()
      expect(layers.imgCtx!.putImageData).not.toHaveBeenCalled()
    })

    it('should undo multiple times', () => {
      const history = useCanvasHistory(layers)

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
      const history = useCanvasHistory(layers)

      history.saveInitialState()
      history.saveState()

      history.undo()

      vi.mocked(layers.maskCtx!.putImageData).mockClear()
      vi.mocked(layers.rgbCtx!.putImageData).mockClear()
      vi.mocked(layers.imgCtx!.putImageData).mockClear()

      history.undo()

      expect(layers.maskCtx!.putImageData).not.toHaveBeenCalled()
      expect(layers.rgbCtx!.putImageData).not.toHaveBeenCalled()
      expect(layers.imgCtx!.putImageData).not.toHaveBeenCalled()
    })
  })

  describe('redo', () => {
    it('should redo to next state', () => {
      const history = useCanvasHistory(layers)

      history.saveInitialState()
      history.saveState()
      history.undo()

      vi.mocked(layers.maskCtx!.putImageData).mockClear()
      vi.mocked(layers.rgbCtx!.putImageData).mockClear()
      vi.mocked(layers.imgCtx!.putImageData).mockClear()

      history.redo()

      expect(layers.maskCtx!.putImageData).toHaveBeenCalled()
      expect(layers.rgbCtx!.putImageData).toHaveBeenCalled()
      expect(layers.imgCtx!.putImageData).toHaveBeenCalled()
      expect(history.canRedo.value).toBe(false)
      expect(history.canUndo.value).toBe(true)
    })

    it('should not redo when no redo states available', () => {
      const history = useCanvasHistory(layers)

      history.saveInitialState()

      vi.mocked(layers.maskCtx!.putImageData).mockClear()
      vi.mocked(layers.rgbCtx!.putImageData).mockClear()
      vi.mocked(layers.imgCtx!.putImageData).mockClear()

      history.redo()

      expect(layers.maskCtx!.putImageData).not.toHaveBeenCalled()
      expect(layers.rgbCtx!.putImageData).not.toHaveBeenCalled()
      expect(layers.imgCtx!.putImageData).not.toHaveBeenCalled()
    })

    it('should redo multiple times', () => {
      const history = useCanvasHistory(layers)

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
      const history = useCanvasHistory(layers)

      history.saveInitialState()
      history.saveState()
      history.undo()

      history.redo()

      vi.mocked(layers.maskCtx!.putImageData).mockClear()
      vi.mocked(layers.rgbCtx!.putImageData).mockClear()
      vi.mocked(layers.imgCtx!.putImageData).mockClear()

      history.redo()

      expect(layers.maskCtx!.putImageData).not.toHaveBeenCalled()
      expect(layers.rgbCtx!.putImageData).not.toHaveBeenCalled()
      expect(layers.imgCtx!.putImageData).not.toHaveBeenCalled()
    })
  })

  describe('clearStates', () => {
    it('should clear all states', () => {
      const history = useCanvasHistory(layers)

      history.saveInitialState()
      history.saveState()
      history.saveState()

      history.clearStates()

      expect(history.canUndo.value).toBe(false)
      expect(history.canRedo.value).toBe(false)
    })

    it('should allow saving initial state after clear', () => {
      const history = useCanvasHistory(layers)

      history.saveInitialState()
      history.clearStates()

      vi.mocked(layers.maskCtx!.getImageData).mockClear()
      vi.mocked(layers.rgbCtx!.getImageData).mockClear()
      vi.mocked(layers.imgCtx!.getImageData).mockClear()

      history.saveInitialState()

      expect(layers.maskCtx!.getImageData).toHaveBeenCalled()
      expect(layers.rgbCtx!.getImageData).toHaveBeenCalled()
      expect(layers.imgCtx!.getImageData).toHaveBeenCalled()
    })
  })

  describe('restoreState', () => {
    it('should not restore if context is missing', () => {
      const history = useCanvasHistory(layers)

      history.saveInitialState()
      history.saveState()

      const savedMaskCtx = layers.maskCtx
      layers.maskCtx = null
      vi.mocked(savedMaskCtx!.putImageData).mockClear()
      vi.mocked(layers.rgbCtx!.putImageData).mockClear()
      vi.mocked(layers.imgCtx!.putImageData).mockClear()

      history.undo()

      expect(savedMaskCtx!.putImageData).not.toHaveBeenCalled()

      layers.maskCtx = savedMaskCtx
    })
  })

  describe('edge cases', () => {
    it('should handle rapid state saves', async () => {
      const history = useCanvasHistory(layers)

      history.saveInitialState()

      for (let i = 0; i < 10; i++) {
        history.saveState()
        await nextTick()
      }

      expect(history.canUndo.value).toBe(true)
    })

    it('should handle maxStates of 1', () => {
      const history = useCanvasHistory(layers, 1)

      history.saveInitialState()
      history.saveState()

      expect(history.canUndo.value).toBe(false)
    })

    it('should handle undo/redo cycling', () => {
      const history = useCanvasHistory(layers)

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
      layers.maskCanvas!.width = 0
      layers.maskCanvas!.height = 0

      const history = useCanvasHistory(layers)

      history.saveInitialState()

      expect(window.requestAnimationFrame).toHaveBeenCalled()
    })
  })
})
