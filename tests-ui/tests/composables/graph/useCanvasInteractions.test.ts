import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useCanvasInteractions } from '@/composables/graph/useCanvasInteractions'
import { app } from '@/scripts/app'
import * as settingStore from '@/stores/settingStore'

// Mock the app and canvas
vi.mock('@/scripts/app', () => ({
  app: {
    canvas: {
      canvas: null as HTMLCanvasElement | null
    }
  }
}))

// Mock the setting store
vi.mock('@/stores/settingStore', () => ({
  useSettingStore: vi.fn()
}))

describe('useCanvasInteractions', () => {
  let mockCanvas: HTMLCanvasElement
  let mockSettingStore: { get: ReturnType<typeof vi.fn> }
  let canvasInteractions: ReturnType<typeof useCanvasInteractions>

  beforeEach(() => {
    // Clear mocks
    vi.clearAllMocks()

    // Create mock canvas element
    mockCanvas = document.createElement('canvas')
    mockCanvas.dispatchEvent = vi.fn()
    app.canvas!.canvas = mockCanvas

    // Mock setting store
    mockSettingStore = { get: vi.fn() }
    vi.mocked(settingStore.useSettingStore).mockReturnValue(
      mockSettingStore as any
    )

    canvasInteractions = useCanvasInteractions()
  })

  describe('handleWheel', () => {
    it('should check navigation mode from settings', () => {
      mockSettingStore.get.mockReturnValue('standard')

      const wheelEvent = new WheelEvent('wheel', {
        ctrlKey: true,
        deltaY: -100
      })

      canvasInteractions.handleWheel(wheelEvent)

      expect(mockSettingStore.get).toHaveBeenCalledWith(
        'Comfy.Canvas.NavigationMode'
      )
    })

    it('should not forward regular wheel events in standard mode', () => {
      mockSettingStore.get.mockReturnValue('standard')

      const wheelEvent = new WheelEvent('wheel', {
        deltaY: -100
      })

      canvasInteractions.handleWheel(wheelEvent)

      expect(mockCanvas.dispatchEvent).not.toHaveBeenCalled()
    })

    it('should forward all wheel events to canvas in legacy mode', () => {
      mockSettingStore.get.mockReturnValue('legacy')

      const wheelEvent = new WheelEvent('wheel', {
        deltaY: -100,
        cancelable: true
      })

      canvasInteractions.handleWheel(wheelEvent)

      expect(mockCanvas.dispatchEvent).toHaveBeenCalled()
    })

    it('should handle missing canvas gracefully', () => {
      ;(app.canvas as any).canvas = null
      mockSettingStore.get.mockReturnValue('standard')

      const wheelEvent = new WheelEvent('wheel', {
        ctrlKey: true,
        deltaY: -100
      })

      expect(() => {
        canvasInteractions.handleWheel(wheelEvent)
      }).not.toThrow()
    })
  })

  describe('forwardEventToCanvas', () => {
    it('should dispatch event to canvas element', () => {
      const wheelEvent = new WheelEvent('wheel', {
        deltaY: -100,
        ctrlKey: true
      })

      canvasInteractions.forwardEventToCanvas(wheelEvent)

      expect(mockCanvas.dispatchEvent).toHaveBeenCalledWith(
        expect.any(WheelEvent)
      )
    })

    it('should handle missing canvas gracefully', () => {
      ;(app.canvas as any).canvas = null

      const wheelEvent = new WheelEvent('wheel', {
        deltaY: -100
      })

      expect(() => {
        canvasInteractions.forwardEventToCanvas(wheelEvent)
      }).not.toThrow()
    })
  })
})
